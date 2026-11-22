
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response(
      { success: false, message: "Only POST requests are allowed" },
      405,
    );
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response(
      { success: false, message: "Supabase environment configuration missing" },
      500,
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return response(
      { success: false, message: "Authentication required" },
      401,
    );
  }

  try {
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      },
    );

    const body = await req.json();
    const action = body?.action;

    // 1. PURCHASE JACKPOT TICKET
    if (action === "purchase_ticket") {
      const drawId = body?.draw_id;
      const requestId = body?.request_id;

      if (
        typeof drawId !== "string" ||
        typeof requestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          .test(drawId) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          .test(requestId)
      ) {
        return response(
          { success: false, message: "Invalid draw ID or request ID" },
          400,
        );
      }

      const { data, error } = await supabase.rpc(
        "jackpot_purchase_ticket",
        {
          p_draw_id: drawId,
          p_request_id: requestId,
        },
      );

      if (error) {
        return response(
          { success: false, message: error.message },
          400,
        );
      }

      return response(data);
    }

    // 2. GET AVAILABLE JACKPOT DRAWS
    if (action === "available_draws") {
      const { data, error } = await supabase.rpc(
        "jackpot_get_available_draws",
      );

      if (error) {
        return response(
          { success: false, message: error.message },
          400,
        );
      }

      return response({
        success: true,
        draws: data ?? [],
      });
    }

    // 3. GET MY JACKPOT TICKETS
    if (action === "my_tickets") {
      const limit = Number(body?.limit ?? 50);
      const offset = Number(body?.offset ?? 0);

      if (
        !Number.isInteger(limit) ||
        !Number.isInteger(offset) ||
        limit < 1 ||
        offset < 0
      ) {
        return response(
          { success: false, message: "Invalid pagination values" },
          400,
        );
      }

      const { data, error } = await supabase.rpc(
        "jackpot_my_tickets",
        {
          p_limit: Math.min(limit, 100),
          p_offset: offset,
        },
      );

      if (error) {
        return response(
          { success: false, message: error.message },
          400,
        );
      }

      return response({
        success: true,
        tickets: data ?? [],
      });
    }

    return response(
      { success: false, message: "Unknown Jackpot action" },
      400,
    );
  } catch (error) {
    console.error("Jackpot Manager Error:", error);

    return response(
      { success: false, message: "An unexpected server error occurred" },
      500,
    );
  }
});
