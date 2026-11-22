
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
      console.error("QR: Required environment variable is missing.");

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

    const authClient = createClient(projectUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(jwt);

    if (authError || !authData.user) {
      console.error(
        "QR authentication failed:",
        authError?.message || "User not found",
      );

      return json({
        success: false,
        message: "Unauthorized",
      }, 401);
    }

    const body = await req.json();
    const ticket_id = body?.ticket_id;

    // Existing requests without ticket_type remain Lottery requests.
    const ticket_type =
      body?.ticket_type === undefined
        ? "lottery"
        : body.ticket_type;

    if (typeof ticket_id !== "string" || !ticket_id.trim()) {
      return json({
        success: false,
        message: "Invalid ticket ID",
      }, 400);
    }

    if (
      ticket_type !== "lottery" &&
      ticket_type !== "jackpot"
    ) {
      return json({
        success: false,
        message: "Invalid ticket type",
      }, 400);
    }

    const admin = createClient(projectUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let ticket: { id: string } | null = null;
    let ticketError: any = null;

    if (ticket_type === "lottery") {
      const result = await admin
        .from("ticket_purchases")
        .select("id")
        .eq("id", ticket_id)
        .eq("user_id", authData.user.id)
        .maybeSingle();

      ticket = result.data;
      ticketError = result.error;
    } else {
      const result = await admin
        .from("jackpot_tickets")
        .select("id")
        .eq("id", ticket_id)
        .eq("user_id", authData.user.id)
        .maybeSingle();

      ticket = result.data;
      ticketError = result.error;
    }

    if (ticketError) {
      console.error(
        "QR ticket database query failed:",
        ticketError.code,
        ticketError.message,
      );

      return json({
        success: false,
        message: "Ticket database query failed",
      }, 500);
    }

    if (!ticket) {
      console.error(
        "QR ticket not found or ownership mismatch.",
      );

      return json({
        success: false,
        message: "Ticket not found for this account",
      }, 404);
    }

    const key = await getEncryptionKey(serviceKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const payload = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        ticket_id: ticket.id,
        ticket_type,
      }),
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      payload,
    );

    const encryptedBytes = new Uint8Array(encrypted);
    const combined = new Uint8Array(
      iv.length + encryptedBytes.length,
    );

    combined.set(iv);
    combined.set(encryptedBytes, iv.length);

    return json({
      success: true,
      token: toBase64Url(combined),
    });
  } catch (error) {
    console.error(
      "QR generation error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return json({
      success: false,
      message: "QR generation failed",
    }, 500);
  }
});
