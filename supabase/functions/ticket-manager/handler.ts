
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

function isValidDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function isPositiveNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
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
        message: "Ticket Manager configuration is missing.",
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

    // Verify authenticated user
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

    // Parse request body
    let body: Record<string, unknown>;

    try {
      const parsed = await req.json();

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return response(400, {
          success: false,
          message: "Invalid request body.",
        });
      }

      body = parsed;
    } catch {
      return response(400, {
        success: false,
        message: "Invalid JSON request body.",
      });
    }

    const action = body.action;

    // =====================================
    // ACTION 1: BUY TICKET
    // =====================================

    if (action === "buy_ticket") {
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

        const status =
          message.toLowerCase().includes("insufficient") ||
          message.toLowerCase().includes("not open")
            ? 409
            : 400;

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
    }

    // =====================================
    // ACTION 2: MY TICKETS
    // =====================================

    if (action === "my_tickets") {
      const limit =
        body.limit === undefined ? 50 : Number(body.limit);

      const offset =
        body.offset === undefined ? 0 : Number(body.offset);

      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isInteger(offset) ||
        offset < 0
      ) {
        return response(400, {
          success: false,
          message: "Invalid limit or offset.",
        });
      }

      const { data, error } = await supabase.rpc(
        "ticket_my_tickets",
        {
          p_limit: limit,
          p_offset: offset,
        },
      );

      if (error) {
        console.error("My tickets RPC error:", error.message);

        return response(400, {
          success: false,
          message: "Could not retrieve your tickets.",
        });
      }

      return response(200, {
        success: true,
        total: data?.total ?? 0,
        tickets: data?.tickets ?? [],
      });
    }

    // =====================================
    // ACTION 3: VERIFY TICKET
    // =====================================

    if (action === "verify_ticket") {
      const drawId = body.draw_id;
      const ticketNumber = body.ticket_number;

      if (!isUUID(drawId)) {
        return response(400, {
          success: false,
          message: "A valid draw_id is required.",
        });
      }

      if (
        typeof ticketNumber !== "string" ||
        ticketNumber.trim().length < 1 ||
        ticketNumber.trim().length > 100
      ) {
        return response(400, {
          success: false,
          message: "A valid ticket_number is required.",
        });
      }

      const { data, error } = await supabase.rpc(
        "ticket_verify",
        {
          p_draw_id: drawId,
          p_ticket_number: ticketNumber.trim().toUpperCase(),
        },
      );

      if (error) {
        console.error("Ticket verification RPC error:", error.message);

        return response(400, {
          success: false,
          message: "Ticket verification failed.",
        });
      }

      return response(200, data);
    }

    // =====================================
    // ACTION 4: DRAW STATUS
    // =====================================

    if (action === "draw_status") {
      const drawId = body.draw_id;

      if (!isUUID(drawId)) {
        return response(400, {
          success: false,
          message: "A valid draw_id is required.",
        });
      }

      const { data, error } = await supabase.rpc(
        "ticket_draw_status",
        {
          p_draw_id: drawId,
        },
      );

      if (error) {
        console.error("Draw status RPC error:", error.message);

        return response(400, {
          success: false,
          message: "Could not retrieve draw status.",
        });
      }

      return response(200, data);
    }

    // =====================================
    // ACTION 5: ADMIN PICK WINNER
    // =====================================

    if (action === "admin_pick_winner") {
      const drawId = body.draw_id;

      if (!isUUID(drawId)) {
        return response(400, {
          success: false,
          message: "A valid draw_id is required.",
        });
      }

      const { data, error } = await supabase.rpc(
        "admin_pick_ticket_winner",
        {
          p_draw_id: drawId,
        },
      );

      if (error) {
        console.error("Admin winner selection RPC error:", error.message);

        return response(400, {
          success: false,
          message: error.message || "Winner selection failed.",
        });
      }

      return response(200, {
        success: true,
        message: "Winner selected successfully.",
        winner: data,
      });
    }

    // =====================================
    // ACTION 6: ADMIN CREATE DRAW
    // =====================================

    if (action === "admin_create_draw") {
      const drawDate = body.draw_date;
      const ticketPrice = body.ticket_price;
      const prizeAmount = body.prize_amount;

      const totalJackpot =
        body.total_jackpot === undefined
          ? 0
          : body.total_jackpot;

      if (!isValidDate(drawDate)) {
        return response(400, {
          success: false,
          message: "A valid draw_date (YYYY-MM-DD) is required.",
        });
      }

      if (!isPositiveNumber(ticketPrice)) {
        return response(400, {
          success: false,
          message: "Ticket price must be greater than zero.",
        });
      }

      if (!isPositiveNumber(prizeAmount)) {
        return response(400, {
          success: false,
          message: "Prize amount must be greater than zero.",
        });
      }

      if (
        typeof totalJackpot !== "number" ||
        !Number.isFinite(totalJackpot) ||
        totalJackpot < 0
      ) {
        return response(400, {
          success: false,
          message: "Total jackpot cannot be negative.",
        });
      }

      const { data, error } = await supabase.rpc(
        "admin_create_ticket_draw",
        {
          p_draw_date: drawDate,
          p_ticket_price: ticketPrice,
          p_prize_amount: prizeAmount,
          p_total_jackpot: totalJackpot,
        },
      );

      if (error) {
        console.error("Admin create draw RPC error:", error.message);

        return response(400, {
          success: false,
          message: error.message || "Draw creation failed.",
        });
      }

      return response(200, {
        success: true,
        message: "Draw created successfully.",
        data,
      });
    }

    // =====================================
    // ACTION 7: ADMIN OPEN DRAW
    // =====================================

    if (action === "admin_open_draw") {
      const drawId = body.draw_id;

      if (!isUUID(drawId)) {
        return response(400, {
          success: false,
          message: "A valid draw_id is required.",
        });
      }

      const { data, error } = await supabase.rpc(
        "admin_open_ticket_draw",
        {
          p_draw_id: drawId,
        },
      );

      if (error) {
        console.error("Admin open draw RPC error:", error.message);

        return response(400, {
          success: false,
          message: error.message || "Could not open draw.",
        });
      }

      return response(200, {
        success: true,
        message: "Draw opened successfully.",
        data,
      });
    }

    // =====================================
    // ACTION 8: ADMIN LIST DRAWS
    // =====================================

    if (action === "admin_list_draws") {
      const { data, error } = await supabase.rpc(
        "admin_list_ticket_draws",
      );

      if (error) {
        console.error("Admin list draws RPC error:", error.message);

        return response(400, {
          success: false,
          message: "Could not retrieve admin draw list.",
        });
      }

      return response(200, data);
    }

    // =====================================
    // INVALID ACTION
    // =====================================

    return response(400, {
      success: false,
      message:
        "Invalid action. Supported actions: buy_ticket, my_tickets, verify_ticket, draw_status, admin_pick_winner, admin_create_draw, admin_open_draw, admin_list_draws.",
    });
  } catch (error) {
    console.error("Ticket Manager error:", error);

    return response(500, {
      success: false,
      message: "An unexpected server error occurred.",
    });
  }
});
