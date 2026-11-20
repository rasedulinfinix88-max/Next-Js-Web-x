
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function decryptToken(token: string, serviceKey: string) {
  if (!token || token.length > 4096) {
    throw new Error("Invalid verification token.");
  }

  const tokenBytes = decodeBase64Url(token);

  if (tokenBytes.length <= 12 + 16) {
    throw new Error("Invalid verification token.");
  }

  // The first 12 bytes are the AES-GCM IV.
  const iv = tokenBytes.slice(0, 12);
  const encryptedData = tokenBytes.slice(12);

  // Must match ticket-qr-create key derivation exactly.
  const keyMaterial = new TextEncoder().encode(
    "ticket-qr-v1:" + serviceKey
  );

  const hash = await crypto.subtle.digest("SHA-256", keyMaterial);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encryptedData
  );

  const payloadText = new TextDecoder().decode(decrypted);
  const payload = JSON.parse(payloadText);

  if (
    payload?.v !== 1 ||
    typeof payload?.ticket_id !== "string" ||
    !payload.ticket_id
  ) {
    throw new Error("Invalid verification token.");
  }

  return payload;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, valid: false, message: "Method not allowed." },
      405
    );
  }

  try {
    const PROJECT_URL = Deno.env.get("PROJECT_URL");
    const PROJECT_SERVICE_KEY = Deno.env.get("PROJECT_SERVICE_KEY");

    if (!PROJECT_URL || !PROJECT_SERVICE_KEY) {
      console.error("Missing required Supabase environment variables.");

      return jsonResponse(
        {
          success: false,
          valid: false,
          message: "Server configuration error.",
        },
        500
      );
    }

    const body = await req.json().catch(() => null);
    const token = body?.token;

    if (typeof token !== "string" || !token) {
      return jsonResponse(
        {
          success: false,
          valid: false,
          message: "Verification token is required.",
        },
        400
      );
    }

    let payload;

    try {
      payload = await decryptToken(token, PROJECT_SERVICE_KEY);
    } catch (error) {
      console.error(
        "Ticket token verification failed:",
        error instanceof Error ? error.message : error
      );

      return jsonResponse({
        success: false,
        valid: false,
        message: "Invalid or unverified ticket.",
      });
    }

    const admin = createClient(
      PROJECT_URL,
      PROJECT_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: ticket, error: ticketError } = await admin
      .from("ticket_purchases")
      .select(
        "id, draw_id, ticket_number, purchase_status, is_winner"
      )
      .eq("id", payload.ticket_id)
      .maybeSingle();

    if (ticketError) {
      console.error(
        "Public ticket database query failed:",
        ticketError.code,
        ticketError.message
      );

      return jsonResponse(
        {
          success: false,
          valid: false,
          message: "Ticket verification is temporarily unavailable.",
        },
        500
      );
    }

    if (!ticket) {
      return jsonResponse({
        success: false,
        valid: false,
        message: "Ticket not found.",
      });
    }

    const { data: draw, error: drawError } = await admin
      .from("ticket_draws")
      .select("draw_date")
      .eq("id", ticket.draw_id)
      .maybeSingle();

    if (drawError) {
      console.error(
        "Public draw database query failed:",
        drawError.code,
        drawError.message
      );

      return jsonResponse(
        {
          success: false,
          valid: false,
          message: "Draw information is temporarily unavailable.",
        },
        500
      );
    }

    const winnerStatus = ticket.is_winner === true
      ? "Winner"
      : "Not Winner";

    return jsonResponse({
      success: true,
      valid: true,
      ticket: {
        ticket_number: String(ticket.ticket_number ?? ""),
        draw_date: String(draw?.draw_date ?? ""),
        purchase_status: String(ticket.purchase_status ?? "Unknown"),
        winner_status: winnerStatus,
      },
    });
  } catch (error) {
    console.error(
      "Public ticket verification error:",
      error instanceof Error ? error.message : error
    );

    return jsonResponse(
      {
        success: false,
        valid: false,
        message: "Ticket verification failed.",
      },
      500
    );
  }
});
