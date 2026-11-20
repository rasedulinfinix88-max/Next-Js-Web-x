
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
const PROJECT_ANON_KEY = Deno.env.get("PROJECT_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function response(
  status: number,
  data: Record<string, unknown>,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response(405, {
      success: false,
      message: "Only POST requests are allowed.",
    });
  }

  try {
    if (!PROJECT_URL || !PROJECT_ANON_KEY) {
      return response(500, {
        success: false,
        message: "Ticket Manager environment configuration is missing.",
      });
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return response(401, {
        success: false,
        message: "Authentication token is required.",
      });
    }

    const supabase = createClient(
      PROJECT_URL,
      PROJECT_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    // Verify the logged-in user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return response(401, {
        success: false,
        message: "Invalid or expired login session.",
      });
    }

    // Read request body
    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return response(400, {
        success: false,
        message: "Invalid JSON request body.",
      });
    }

    const action = body.action;

    if (action !== "buy_ticket") {
      return response(400, {
        success: false,
        message: "Invalid action. Supported action: buy_ticket.",
      });
    }

    const drawId = body.draw_id;
    const requestId = body.request_id;

    if (!isUUID(drawId)) {
      return response(400, {
        success: false,
        message: "A valid draw_id is required.",
      });
    }

    if (!isUUID(requestId)) {
      return response(400, {
        success: false,
        message: "A valid request_id is required.",
      });
    }

    // Execute atomic database purchase
    const { data, error } = await supabase.rpc(
      "purchase_ticket_atomic",
      {
        p_draw_id: drawId,
        p_request_id: requestId,
      },
    );

    if (error) {
      console.error("Ticket purchase RPC error:", error.message);

      const message = error.message || "Ticket purchase failed.";

      let status = 400;

      if (
        message.toLowerCase().includes("insufficient") ||
        message.toLowerCase().includes("not open")
      ) {
        status = 409;
      }

      return response(status, {
        success: false,
        message,
      });
    }

    if (!data || data.success !== true) {
      return response(500, {
        success: false,
        message: "Ticket purchase could not be confirmed.",
      });
    }

    return response(200, {
      success: true,
      message: data.duplicate_request
        ? "This purchase request was already completed."
        : "Ticket purchased successfully.",
      ticket: {
        id: data.ticket_id,
        number: data.ticket_number,
        draw_id: data.draw_id,
        price: data.ticket_price,
      },
      wallet: {
        balance_before: data.balance_before ?? null,
        balance_after: data.balance_after ?? null,
      },
      duplicate_request: data.duplicate_request,
    });
  } catch (error) {
    console.error("Ticket Manager error:", error);

    return response(500, {
      success: false,
      message: "An unexpected server error occurred.",
    });
  }
});
