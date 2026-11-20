
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getEncryptionKey(secret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("ticket-qr-v1:" + secret),
  );

  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  try {
    const projectUrl = Deno.env.get("PROJECT_URL");
    const anonKey = Deno.env.get("PROJECT_ANON_KEY");
    const serviceKey = Deno.env.get("PROJECT_SERVICE_KEY");

    if (!projectUrl || !anonKey || !serviceKey) {
      return json({
        success: false,
        message: "Server configuration error",
      }, 500);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return json({
        success: false,
        message: "Unauthorized",
      }, 401);
    }

    const jwt = authorization.replace(/^Bearer\s+/i, "");

    const authClient = createClient(projectUrl, anonKey);

    const { data: authData, error: authError } =
      await authClient.auth.getUser(jwt);

    if (authError || !authData.user) {
      return json({
        success: false,
        message: "Unauthorized",
      }, 401);
    }

    const { ticket_id } = await req.json();

    if (typeof ticket_id !== "string" || !ticket_id) {
      return json({
        success: false,
        message: "Invalid ticket",
      }, 400);
    }

    const admin = createClient(projectUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: ticket, error } = await admin
      .from("ticket_purchases")
      .select("id")
      .eq("id", ticket_id)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (error || !ticket) {
      return json({
        success: false,
        message: "Ticket not found",
      }, 404);
    }

    const key = await getEncryptionKey(serviceKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const payload = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        ticket_id: ticket.id,
      }),
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      payload,
    );

    const encryptedBytes = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedBytes.length);

    combined.set(iv);
    combined.set(encryptedBytes, iv.length);

    return json({
      success: true,
      token: toBase64Url(combined),
    });
  } catch {
    return json({
      success: false,
      message: "QR generation failed",
    }, 500);
  }
});
