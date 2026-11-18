
// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("PROJECT_URL") ?? "";
const serviceRoleKey = Deno.env.get("PROJECT_SERVICE_KEY") ?? "";
const anonKey = Deno.env.get("PROJECT_ANON_KEY") ?? "";

function response(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeMobile(value: string) {
  return value.replace(/\D/g, "");
}

async function hashSecretPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 210000,
      hash: "SHA-256",
    },
    key,
    256
  );

  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `pbkdf2_sha256$210000$${saltHex}$${hashHex}`;
}

async function generateLotteryId(supabase: any) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const randomBytes = crypto.getRandomValues(new Uint32Array(1));
    const number = 10000000 + (randomBytes[0] % 90000000);
    const lotteryId = String(number);

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("lottery_id", lotteryId)
      .maybeSingle();

    if (error) throw error;

    if (!data) return lotteryId;
  }

  throw new Error("Could not generate a unique Lottery ID. Try again.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Supabase environment configuration is missing");
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body = await req.json();

    const { action, password, ref } = body;

    // =========================================
    // SIGNUP
    // =========================================

    if (action === "signup") {
      const fullName = String(
        body.full_name ?? body.fullName ?? ""
      ).trim();

      const mobile = normalizeMobile(
        String(body.user_mobile ?? body.mobile ?? "")
      );

      const userPassword = String(password ?? "");

      const confirmPassword = String(
        body.confirm_password ?? body.confirmPassword ?? ""
      );

      const secretPin = String(
        body.secret_pin ?? body.secretPin ?? ""
      );

      if (
        !fullName ||
        !mobile ||
        !userPassword ||
        !confirmPassword ||
        !secretPin
      ) {
        return response(
          { error: "All signup fields are required" },
          400
        );
      }

      if (mobile.length < 10 || mobile.length > 15) {
        return response({ error: "Invalid mobile number" }, 400);
      }

      if (userPassword !== confirmPassword) {
        return response(
          { error: "Passwords do not match" },
          400
        );
      }

      if (userPassword.length < 8) {
        return response(
          { error: "Password must be at least 8 characters" },
          400
        );
      }

      if (!/^\d{4}$/.test(secretPin)) {
        return response(
          { error: "Secret PIN must contain exactly 4 digits" },
          400
        );
      }

      // Check duplicate mobile
      const { data: existingMobile, error: mobileCheckError } =
        await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("user_mobile", mobile)
          .maybeSingle();

      if (mobileCheckError) throw mobileCheckError;

      if (existingMobile) {
        return response(
          { error: "This mobile number is already registered" },
          409
        );
      }

      // Generate Lottery ID
      const lotteryId = await generateLotteryId(supabaseAdmin);

      // Hash Secret PIN
      const hashedPin = await hashSecretPin(secretPin);

      // Internal Supabase Auth email
      const email = `${mobile}@user.local`;

      // Create Auth user
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: userPassword,
          email_confirm: true,
        });

      if (authError) {
        if (authError.message?.toLowerCase().includes("already")) {
          return response(
            { error: "This mobile number is already registered" },
            409
          );
        }

        throw authError;
      }

      // Insert profile
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: authData.user.id,
          full_name: fullName,
          user_mobile: mobile,
          user_email: email,
          lottery_id: lotteryId,
          user_secret_pin: hashedPin,
          account_status: "active",
          user_role: "user",
        });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      // Referral logic
      if (ref) {
        try {
          const referralCode = String(ref).trim();

          const { data: referrerData } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("lottery_id", referralCode)
            .maybeSingle();

          if (
            referrerData &&
            referrerData.id !== authData.user.id
          ) {
            const { error: referralError } = await supabaseAdmin
              .from("user_invited_friend_referral")
              .insert({
                referrer_id: referrerData.id,
                referred_user_id: authData.user.id,
                deposit_amount: 0,
                bonus_amount: 0,
                status: "pending",
              });

            if (referralError) {
              console.error("Referral save error:", referralError);
            }
          }
        } catch (referralError) {
          console.error("Referral error:", referralError);
        }
      }

      return response({
        message: "Signup successful",
        lottery_id: lotteryId,
        user: {
          id: authData.user.id,
          full_name: fullName,
          user_mobile: mobile,
          account_status: "active",
          user_role: "user",
        },
      });
    }

    // =========================================
    // LOGIN
    // =========================================

    if (action === "login") {
      const identifier = String(
        body.identifier ??
        body.lottery_id ??
        body.user_mobile ??
        body.mobile ??
        body.game_id ??
        ""
      ).trim();

      const userPassword = String(password ?? "");

      if (!identifier || !userPassword) {
        return response(
          { error: "Lottery ID or mobile and password are required" },
          400
        );
      }

      // Find by Lottery ID first
      let { data: profile, error: profileError } =
        await supabaseAdmin
          .from("profiles")
          .select("id, lottery_id, user_mobile, account_status")
          .eq("lottery_id", identifier)
          .maybeSingle();

      if (profileError) throw profileError;

      // Otherwise find by mobile
      if (!profile) {
        const normalizedIdentifier = normalizeMobile(identifier);

        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("id, lottery_id, user_mobile, account_status")
          .eq("user_mobile", normalizedIdentifier)
          .maybeSingle();

        if (error) throw error;

        profile = data;
      }

      if (!profile) {
        return response(
          { error: "Invalid Lottery ID/Mobile or Password" },
          401
        );
      }

      if (profile.account_status !== "active") {
        return response(
          { error: "Your account is not active" },
          403
        );
      }

      const loginEmail = `${profile.user_mobile}@user.local`;

      const supabasePublic = createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: loginData, error: loginError } =
        await supabasePublic.auth.signInWithPassword({
          email: loginEmail,
          password: userPassword,
        });

      if (loginError) {
        return response(
          { error: "Invalid Lottery ID/Mobile or Password" },
          401
        );
      }

      return response({
        message: "Login successful",
        session: loginData.session,
        user: {
          id: profile.id,
          lottery_id: profile.lottery_id,
          user_mobile: profile.user_mobile,
          account_status: profile.account_status,
        },
      });
    }

    return response({ error: "Invalid action" }, 400);

  } catch (error) {
    console.error("Auth Manager Error:", error);

    return response(
      { error: error.message ?? "Internal server error" },
      400
    );
  }
});
