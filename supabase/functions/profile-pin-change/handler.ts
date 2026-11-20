
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("PROJECT_URL") ?? "";
const serviceRoleKey = Deno.env.get("PROJECT_SERVICE_KEY") ?? "";
const anonKey = Deno.env.get("PROJECT_ANON_KEY") ?? "";

function response(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid stored PIN format");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
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

  return `pbkdf2_sha256$210000$${toHex(salt)}$${toHex(
    new Uint8Array(derivedBits)
  )}`;
}

async function verifySecretPin(pin: string, stored: string) {
  const parts = stored.split("$");

  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2_sha256" ||
    parts[1] !== "210000"
  ) {
    return false;
  }

  const salt = fromHex(parts[2]);
  const expected = fromHex(parts[3]);

  if (salt.length !== 16 || expected.length !== 32) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const result = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 210000,
        hash: "SHA-256",
      },
      key,
      256
    )
  );

  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= result[i] ^ expected[i];
  }

  return difference === 0;
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
      return response({ error: "Server configuration is missing" }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");

    if (!token) {
      return response({ error: "Authentication required" }, 401);
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return response({ error: "Invalid or expired session" }, 401);
    }

    const body = await req.json();

    const currentPin = String(body.current_pin ?? "");
    const newPin = String(body.new_pin ?? "");

    if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
      return response({ error: "Both PINs must contain exactly 4 digits" }, 400);
    }

    if (currentPin === newPin) {
      return response({ error: "New PIN must be different" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_secret_pin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.user_secret_pin) {
      return response({ error: "PIN information was not found" }, 404);
    }

    const isValid = await verifySecretPin(
      currentPin,
      profile.user_secret_pin
    );

    if (!isValid) {
      return response({ error: "Current PIN is incorrect" }, 401);
    }

    const newHash = await hashSecretPin(newPin);

    const { error: updateError } = await admin
      .from("profiles")
      .update({ user_secret_pin: newHash })
      .eq("id", user.id);

    if (updateError) {
      console.error("PIN update error:", updateError);
      return response({ error: "Could not update PIN" }, 500);
    }

    return response({ success: true, message: "PIN changed successfully" });
  } catch (error) {
    console.error("Profile PIN Change Error:", error);
    return response(
      { error: "An unexpected server error occurred" },
      500
    );
  }
});
