
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

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function maskCardNumber(value: string | null) {
  if (!value) return null;
  return `•••• •••• •••• ${value.slice(-4)}`;
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
      return response(
        { error: "Supabase environment configuration is missing" },
        500
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return response({ error: "Authentication required" }, 401);
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return response({ error: "Invalid access token" }, 401);
    }

    // Verify the caller's access token.
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (authError || !user) {
      return response({ error: "Invalid or expired session" }, 401);
    }

    // Service-role client is used only after caller verification.
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

    // Verify active Admin or Super Admin from the database.
    const { data: actor, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_role, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (actorError || !actor) {
      return response({ error: "Administrator profile not found" }, 403);
    }

    if (
      actor.account_status !== "active" ||
      !["admin", "super_admin"].includes(actor.user_role)
    ) {
      return response({ error: "Administrator access denied" }, 403);
    }

    const body = await req.json();
    const action = String(body.action ?? "").trim();

    // =========================================
    // LIST USERS
    // =========================================

    if (action === "list_users") {
      const search = String(body.search ?? "")
        .trim()
        .replace(/[%_,()]/g, "")
        .slice(0, 80);

      const role = String(body.role ?? "").trim();
      const status = String(body.status ?? "").trim();

      const page = Math.max(
        1,
        Math.min(100000, Number.parseInt(body.page ?? "1", 10) || 1)
      );

      const limit = Math.max(
        1,
        Math.min(100, Number.parseInt(body.limit ?? "25", 10) || 25)
      );

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabaseAdmin
        .from("profiles")
        .select(
          `
          id,
          full_name,
          user_mobile,
          user_email,
          lottery_id,
          account_status,
          user_role,
          balance,
          address_verified,
          identification_verified,
          user_lottery_fee_paid,
          user_lottery_is_terms_accepted,
          created_at,
          update_at,
          user_account_card_number
          `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,user_mobile.ilike.%${search}%,user_email.ilike.%${search}%,lottery_id.ilike.%${search}%`
        );
      }

      if (role) {
        if (!["user", "admin", "super_admin"].includes(role)) {
          return response({ error: "Invalid role filter" }, 400);
        }
        query = query.eq("user_role", role);
      }

      if (status) {
        if (!["active", "suspended"].includes(status)) {
          return response({ error: "Invalid status filter" }, 400);
        }
        query = query.eq("account_status", status);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("List users error:", error);
        return response({ error: "Could not load users" }, 500);
      }

      const users = (data ?? []).map((profile) => ({
        ...profile,
        user_account_card_number: maskCardNumber(
          profile.user_account_card_number
        ),
      }));

      return response({
        success: true,
        users,
        pagination: {
          page,
          limit,
          total: count ?? 0,
          total_pages: Math.ceil((count ?? 0) / limit),
        },
        administrator_role: actor.user_role,
      });
    }

    // =========================================
    // GET USER PROFILE DETAILS
    // =========================================

    if (action === "get_user") {
      const targetUserId = String(body.user_id ?? "").trim();

      if (!isValidUuid(targetUserId)) {
        return response({ error: "Valid user ID is required" }, 400);
      }

      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select(
          `
          id,
          full_name,
          user_mobile,
          user_email,
          lottery_id,
          account_status,
          user_role,
          user_birthday,
          postal_code,
          city_address,
          user_address_store,
          address_verified,
          identification_verified,
          user_lottery_fee_paid,
          user_lottery_is_terms_accepted,
          user_account_card_number,
          balance,
          created_at,
          update_at
          `
        )
        .eq("id", targetUserId)
        .maybeSingle();

      if (error) {
        console.error("Get user error:", error);
        return response({ error: "Could not load user profile" }, 500);
      }

      if (!profile) {
        return response({ error: "User not found" }, 404);
      }

      return response({
        success: true,
        user: {
          ...profile,
          user_account_card_number: maskCardNumber(
            profile.user_account_card_number
          ),
        },
        administrator_role: actor.user_role,
      });
    }

    return response({ error: "Invalid action" }, 400);

  } catch (error) {
    console.error("Admin User Manager Error:", error);

    return response(
      { error: "Internal server error" },
      500
    );
  }
});
