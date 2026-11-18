
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

async function hashSecretPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 310000,
      hash: "SHA-256",
    },
    key,
    256,
  );

  return `pbkdf2$310000$${base64(salt)}$${base64(new Uint8Array(bits))}`;
}

function generateLotteryId() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(10000000 + (random[0] % 90000000));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      throw new Error("Supabase environment settings are missing.");
    }

    const body = await req.json();
    const { action } = body;

    // SIGNUP
    if (action === "signup") {
      const fullName = String(body.full_name ?? "").trim();
      const mobile = String(body.mobile ?? "").trim();
      const password = String(body.password ?? "");
      const secretPin = String(body.secret_pin ?? "");
      const ref = String(body.ref ?? "").trim();

      if (!fullName || !mobile || !password || !secretPin) {
        throw new Error("সবগুলো ঘর পূরণ করুন।");
      }

      if (!/^01\d{9}$/.test(mobile)) {
        throw new Error("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।");
      }

      if (password.length < 8) {
        throw new Error("Password কমপক্ষে ৮ অক্ষরের হতে হবে।");
      }

      if (!/^\d{4}$/.test(secretPin)) {
        throw new Error("Secret PIN অবশ্যই ৪ ডিজিটের হতে হবে।");
      }

      const { data: existingMobile } = await admin
        .from("profiles")
        .select("id")
        .eq("user_mobile", mobile)
        .maybeSingle();

      if (existingMobile) {
        throw new Error("এই মোবাইল নম্বরটি ইতিমধ্যে নিবন্ধিত।");
      }

      const email = `${mobile}@user.local`;

      const { data: authData, error: authError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

      if (authError || !authData.user) {
        throw new Error(
          authError?.message || "Account তৈরি করা যায়নি।",
        );
      }

      const pinHash = await hashSecretPin(secretPin);
      let createdProfile = false;
      let lotteryId = "";

      try {
        for (let attempt = 0; attempt < 10; attempt++) {
          lotteryId = generateLotteryId();

          const { data: existingLottery } = await admin
            .from("profiles")
            .select("id")
            .eq("lottery_id", lotteryId)
            .maybeSingle();

          if (existingLottery) continue;

          const { error: profileError } = await admin
            .from("profiles")
            .insert({
              id: authData.user.id,
              full_name: fullName,
              user_mobile: mobile,
              user_email: email,
              lottery_id: lotteryId,
              account_status: "active",
              user_role: "user",
              user_secret_pin: pinHash,
            });

          if (!profileError) {
            createdProfile = true;
            break;
          }

          const duplicateLottery =
            profileError.code === "23505" &&
            (
              profileError.message.includes("lottery_id") ||
              profileError.message.includes("profiles_lottery_id_key")
            );

          if (duplicateLottery) continue;

          throw profileError;
        }

        if (!createdProfile) {
          throw new Error("Lottery ID তৈরি করা যায়নি। আবার চেষ্টা করুন।");
        }

        // Referral: ref হিসেবে পুরোনো Lottery ID থাকলে সংরক্ষণ
        if (ref) {
          try {
            const { data: referrer } = await admin
              .from("profiles")
              .select("id")
              .eq("lottery_id", ref)
              .maybeSingle();

            if (referrer && referrer.id !== authData.user.id) {
              await admin
                .from("user_invited_friend_referral")
                .insert({
                  referrer_id: referrer.id,
                  referred_user_id: authData.user.id,
                  deposit_amount: 0,
                  bonus_amount: 0,
                  status: "pending",
                });
            }
          } catch (refError) {
            console.error("Referral save error:", refError);
          }
        }
      } catch (profileError) {
        await admin.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      return response({
        message: "Signup successful",
        lottery_id: lotteryId,
      });
    }

    // LOGIN
    if (action === "login") {
      const identifier = String(body.identifier ?? "").trim();
      const password = String(body.password ?? "");

      if (!identifier || !password) {
        throw new Error("Lottery ID অথবা Mobile Number এবং Password দিন।");
      }

      let query = admin
        .from("profiles")
        .select("id, user_mobile, user_email, account_status");

      if (/^[1-9]\d{7}$/.test(identifier)) {
        query = query.eq("lottery_id", identifier);
      } else if (/^01\d{9}$/.test(identifier)) {
        query = query.eq("user_mobile", identifier);
      } else {
        throw new Error("সঠিক Lottery ID অথবা Mobile Number দিন।");
      }

      const { data: profile, error: profileError } =
        await query.maybeSingle();

      if (profileError || !profile) {
        throw new Error("Invalid Lottery ID/Mobile Number or Password.");
      }

      if (profile.account_status !== "active") {
        throw new Error("আপনার Account বর্তমানে Active নেই।");
      }

      const loginEmail =
        profile.user_email || `${profile.user_mobile}@user.local`;

      const publicClient = createClient(SUPABASE_URL, ANON_KEY);

      const { data: loginData, error: loginError } =
        await publicClient.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

      if (loginError || !loginData.session) {
        throw new Error("Invalid Lottery ID/Mobile Number or Password.");
      }

      return response({
        message: "Login successful",
        session: loginData.session,
        user: loginData.user,
      });
    }

    throw new Error("Invalid action.");
  } catch (error) {
    console.error("Auth manager error:", error);
    return response(
      { error: error instanceof Error ? error.message : "Request failed." },
      400,
    );
  }
});
