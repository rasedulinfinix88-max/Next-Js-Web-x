
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

function isUUID(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value));
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

    // Support both frontend parameter naming styles.
    const drawId = body?.p_draw_id ?? body?.draw_id;
    const category = body?.p_category ?? body?.category;
    const salesOpenAt = body?.p_sales_open_at ?? body?.sales_open_at;
    const salesCloseAt = body?.p_sales_close_at ?? body?.sales_close_at;
    const drawAt = body?.p_draw_at ?? body?.draw_at;

    // USER: PURCHASE TICKET
    if (action === "purchase_ticket") {
      const purchaseDrawId = body?.draw_id;
      const requestId = body?.request_id;

      if (!isUUID(purchaseDrawId) || !isUUID(requestId)) {
        return response(
          { success: false, message: "Invalid draw ID or request ID" },
          400,
        );
      }

      const { data, error } = await supabase.rpc(
        "jackpot_purchase_ticket",
        {
          p_draw_id: purchaseDrawId,
          p_request_id: requestId,
        },
      );

      if (error) {
        return response({ success: false, message: error.message }, 400);
      }

      return response(data);
    }

    // USER: AVAILABLE DRAWS
    if (action === "available_draws") {
      const { data, error } = await supabase.rpc(
        "jackpot_get_available_draws",
      );

      if (error) {
        return response({ success: false, message: error.message }, 400);
      }

      return response({ success: true, draws: data ?? [] });
    }

    // USER: MY TICKETS
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
        return response({ success: false, message: error.message }, 400);
      }

      return response({ success: true, tickets: data ?? [] });
    }

    // ADMIN: CREATE DRAW
    if (action === "admin_create_draw") {
      if (!["500", "1000", "2000"].includes(category)) {
        return response(
          { success: false, message: "Invalid Jackpot category" },
          400,
        );
      }

      if (
        !isValidDate(salesOpenAt) ||
        !isValidDate(salesCloseAt) ||
        !isValidDate(drawAt)
      ) {
        return response(
          { success: false, message: "Invalid schedule dates" },
          400,
        );
      }

      const { data, error } = await supabase.rpc(
        "jackpot_admin_create_draw",
        {
          p_category: category,
          p_sales_open_at: salesOpenAt,
          p_sales_close_at: salesCloseAt,
          p_draw_at: drawAt,
        },
      );

      if (error) {
        return response({ success: false, message: error.message }, 400);
      }

      return response(data);
    }

    // ADMIN: LIST DRAWS
    if (action === "admin_list_draws") {
      const { data, error } = await supabase.rpc(
        "jackpot_admin_list_draws",
      );

      if (error) {
        return response({ success: false, message: error.message }, 400);
      }

      return response({ success: true, draws: data ?? [] });
    }

    // ADMIN: UPDATE DRAW
    if (action === "admin_update_draw") {
      if (!isUUID(drawId)) {
        return response(
          { success: false, message: "Invalid draw ID" },
          400,
        );
      }

      if (
        !isValidDate(salesOpenAt) ||
        !isValidDate(salesCloseAt) ||
        !isValidDate(drawAt)
      ) {
        return response(
          { success: false, message: "Invalid schedule dates" },
          400,
        );
      }

      const { data, error } = await supabase.rpc(
        "jackpot_admin_update_draw",
        {
          p_draw_id: drawId,
          p_sales_open_at: salesOpenAt,
          p_sales_close_at: salesCloseAt,
          p_draw_at: drawAt,
        },
      );

      if (error) {
        return response({ success: false, message: error.message }, 400);
      }

      return response(data);
    }

    // ADMIN: OPEN DRAW
    if (action === "admin_open_draw") {
      if (!isUUID(drawId)) {
        return response(
          { success: false, message: "Invalid draw ID" },
          400,
        );
      }

      const { data, error } = await supabase.rpc(
        "jackpot_admin_open_draw",
        { p_draw_id: drawId },
      );

      if (error) {
        return response({ success: false, message: error.message }, 400);
      }

      return response(data);
    }

    // ADMIN: CLOSE DRAW
    if (action === "admin_close_draw") {
      if (!isUUID(drawId)) {
        return response(
          { success: false, message: "Invalid draw ID" },
          400,
        );
      }

      const { data, error } = await supabase.rpc(
        "jackpot_admin_close_draw",
        { p_draw_id: drawId },
      );

      if (error) {
        return response({ success: false, message: error.message }, 400);
      }

      return response(data);
    }

    // ADMIN: RANDOM WINNER SELECTION
    if (action === "admin_select_random_winner") {
      if (!isUUID(drawId)) {
        return response(
          { success: false, message: "Invalid draw ID" },
          400,
        );
      }

      const { data, error } = await supabase.rpc(
        "jackpot_v2_admin_select_random_winner",
        { p_draw_id: drawId },
      );

      if (error) {
        return response({ success: false, message: error.message }, 400);
      }

      return response(data);
    }

    // ADMIN: PUBLISH RESULT
    if (action === "admin_publish_result") {
      if (!isUUID(drawId)) {
        return response(
          { success: false, message: "Invalid draw ID" },
          400,
        );
      }

      const { data, error } = await supabase.rpc(
        "jackpot_v2_admin_publish_result",
        { p_draw_id: drawId },
      );

      if (error) {
        return response({ success: false, message: error.message }, 400);
      }

      return response(data);
    }

    return response(
      { success: false, message: "Unknown Jackpot action" },
      400,
    );

  } catch (error) {
    console.error("Jackpot Manager Error:", error);

    return response(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : "An unexpected server error occurred",
      },
      500,
    );
  }
});
