
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

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function trackingId() {
  return `DEP-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function validAmount(value: unknown): number | null {
  const amountString = String(value ?? "").trim();

  if (!/^\d{1,12}(\.\d{1,8})?$/.test(amountString)) {
    return null;
  }

  const amount = Number(amountString);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
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

    // Verify the caller's Supabase session.
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

    // Service-role client for protected database operations.
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

    // User JWT client for authenticated database functions.
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });

    // Verify profile and account status.
    const { data: actor, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_role, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (actorError || !actor) {
      return response({ error: "User profile not found" }, 403);
    }

    if (actor.account_status !== "active") {
      return response({ error: "Account is not active" }, 403);
    }

    const body = await req.json();
    const action = String(body.action ?? "").trim();

    const isAdmin = ["admin", "super_admin"].includes(actor.user_role);
    const isSuperAdmin = actor.user_role === "super_admin";

    // Read global deposit configuration.
    async function getGlobalSettings() {
      return await supabaseAdmin
        .from("control_payment_method")
        .select("is_deposit_enabled, maintenance_message")
        .eq("method_code", "GLOBAL")
        .maybeSingle();
    }

    // =========================================
    // GET ACTIVE PAYMENT METHODS
    // =========================================

    if (action === "get_payment_methods") {
      const { data: global, error: globalError } =
        await getGlobalSettings();

      if (globalError || !global) {
        return response({ error: "Deposit settings unavailable" }, 500);
      }

      const { data: methods, error } = await supabaseAdmin
        .from("control_payment_method")
        .select(`
          id,
          method_code,
          method_name,
          method_type,
          account_name,
          admin_payment_number,
          wallet_address,
          network,
          method_logo_url,
          instructions,
          min_deposit,
          max_deposit,
          is_active
        `)
        .not("method_code", "eq", "GLOBAL")
        .eq("is_active", true)
        .order("method_name");

      if (error) {
        console.error("Payment methods error:", error);
        return response({ error: "Could not load payment methods" }, 500);
      }

      return response({
        success: true,
        deposit_enabled: global.is_deposit_enabled,
        maintenance_message: global.maintenance_message,
        methods: methods ?? [],
      });
    }

    // =========================================
    // CREATE DEPOSIT REQUEST
    // =========================================

    if (action === "create_deposit") {
      if (actor.user_role !== "user") {
        return response({ error: "This action is for users only" }, 403);
      }

      const methodId = String(body.payment_method_id ?? "").trim();
      const amount = validAmount(body.amount);
      const transactionId = String(body.transaction_id ?? "").trim();
      const senderAccount = String(body.sender_account ?? "").trim();

      if (!isValidUuid(methodId)) {
        return response({ error: "Valid payment method is required" }, 400);
      }

      if (amount === null) {
        return response({ error: "Invalid deposit amount" }, 400);
      }

      if (transactionId.length < 3 || transactionId.length > 120) {
        return response({ error: "Transaction ID must be 3 to 120 characters" }, 400);
      }

      if (senderAccount.length > 120) {
        return response({ error: "Sender account is too long" }, 400);
      }

      const { data: global, error: globalError } =
        await getGlobalSettings();

      if (globalError || !global) {
        return response({ error: "Deposit settings unavailable" }, 500);
      }

      if (!global.is_deposit_enabled) {
        return response({
          error: global.maintenance_message ||
            "Deposit service is temporarily unavailable",
        }, 403);
      }

      const { data: method, error: methodError } = await supabaseAdmin
        .from("control_payment_method")
        .select(`
          id,
          method_code,
          method_name,
          method_type,
          admin_payment_number,
          wallet_address,
          min_deposit,
          max_deposit,
          is_active
        `)
        .eq("id", methodId)
        .maybeSingle();

      if (methodError || !method) {
        return response({ error: "Payment method not found" }, 404);
      }

      if (!method.is_active || method.method_code === "GLOBAL") {
        return response({ error: "Payment method is unavailable" }, 403);
      }

      // A method must have its receiving details configured.
      const paymentDetailsReady =
        method.method_type === "crypto"
          ? Boolean(method.wallet_address?.trim())
          : Boolean(method.admin_payment_number?.trim());

      if (!paymentDetailsReady) {
        return response({
          error: "This payment method is not configured yet",
        }, 403);
      }

      if (
        method.min_deposit !== null &&
        amount < Number(method.min_deposit)
      ) {
        return response({
          error: `Minimum deposit is ${method.min_deposit}`,
        }, 400);
      }

      if (
        method.max_deposit !== null &&
        amount > Number(method.max_deposit)
      ) {
        return response({
          error: `Maximum deposit is ${method.max_deposit}`,
        }, 400);
      }

      const { data: deposit, error: insertError } =
        await supabaseAdmin
          .from("deposit_transactions")
          .insert({
            user_id: user.id,
            deposit_tracking_id: trackingId(),
            payment_method_id: method.id,
            payment_method_name: method.method_name,
            payment_method_code: method.method_code,
            amount,
            transaction_id: transactionId,
            sender_account: senderAccount || null,
            status: "pending",
          })
          .select(`
            id,
            deposit_tracking_id,
            payment_method_name,
            payment_method_code,
            amount,
            transaction_id,
            status,
            created_at
          `)
          .single();

      if (insertError) {
        if (insertError.code === "23505") {
          return response({
            error: "This transaction ID has already been used",
          }, 409);
        }

        console.error("Create deposit error:", insertError);
        return response({ error: "Could not create deposit request" }, 500);
      }

      return response({
        success: true,
        message: "Deposit request submitted successfully",
        deposit,
      }, 201);
    }

    // =========================================
    // MY DEPOSIT HISTORY
    // =========================================

    if (action === "my_deposit_history") {
      const page = Math.max(
        1,
        Math.min(100000, Number.parseInt(body.page ?? "1", 10) || 1)
      );

      const limit = Math.max(
        1,
        Math.min(100, Number.parseInt(body.limit ?? "20", 10) || 20)
      );

      const from = (page - 1) * limit;

      const { data, error, count } = await supabaseAdmin
        .from("deposit_transactions")
        .select(`
          id,
          deposit_tracking_id,
          payment_method_name,
          payment_method_code,
          amount,
          transaction_id,
          sender_account,
          status,
          admin_note,
          rejection_reason,
          reviewed_at,
          created_at
        `, { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1);

      if (error) {
        console.error("Deposit history error:", error);
        return response({ error: "Could not load deposit history" }, 500);
      }

      return response({
        success: true,
        deposits: data ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          total_pages: Math.ceil((count ?? 0) / limit),
        },
      });
    }

    // =========================================
    // ADMIN: LIST DEPOSIT REQUESTS
    // =========================================

    if (action === "admin_deposit_list") {
      if (!isAdmin) {
        return response({ error: "Administrator access denied" }, 403);
      }

      const status = String(body.status ?? "").trim();

      if (
        status &&
        !["pending", "approved", "rejected"].includes(status)
      ) {
        return response({ error: "Invalid deposit status filter" }, 400);
      }

      const page = Math.max(
        1,
        Math.min(100000, Number.parseInt(body.page ?? "1", 10) || 1)
      );

      const limit = Math.max(
        1,
        Math.min(100, Number.parseInt(body.limit ?? "25", 10) || 25)
      );

      const from = (page - 1) * limit;

      let query = supabaseAdmin
        .from("deposit_transactions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Admin deposit list error:", error);
        return response({ error: "Could not load deposit requests" }, 500);
      }

      return response({
        success: true,
        deposits: data ?? [],
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
    // ADMIN: APPROVE DEPOSIT
    // =========================================

    if (action === "approve_deposit") {
      if (!isAdmin) {
        return response({ error: "Administrator access denied" }, 403);
      }

      const depositId = String(body.deposit_id ?? "").trim();
      const adminNote = String(body.admin_note ?? "").trim();

      if (!isValidUuid(depositId)) {
        return response({ error: "Valid deposit ID is required" }, 400);
      }

      if (adminNote.length > 1000) {
        return response({ error: "Admin note is too long" }, 400);
      }

      const { data, error } = await supabaseUser.rpc(
        "approve_deposit_transaction",
        {
          p_deposit_id: depositId,
          p_admin_note: adminNote || null,
        }
      );

      if (error) {
        console.error("Approve deposit error:", error);
        return response({
          error: error.message || "Could not approve deposit",
        }, 400);
      }

      return response(data);
    }

    // =========================================
    // ADMIN: REJECT DEPOSIT
    // =========================================

    if (action === "reject_deposit") {
      if (!isAdmin) {
        return response({ error: "Administrator access denied" }, 403);
      }

      const depositId = String(body.deposit_id ?? "").trim();
      const reason = String(body.rejection_reason ?? "").trim();

      if (!isValidUuid(depositId)) {
        return response({ error: "Valid deposit ID is required" }, 400);
      }

      if (!reason || reason.length > 1000) {
        return response({
          error: "Rejection reason is required (maximum 1000 characters)",
        }, 400);
      }

      const { data, error } = await supabaseUser.rpc(
        "reject_deposit_transaction",
        {
          p_deposit_id: depositId,
          p_rejection_reason: reason,
        }
      );

      if (error) {
        console.error("Reject deposit error:", error);
        return response({
          error: error.message || "Could not reject deposit",
        }, 400);
      }

      return response(data);
    }

    // =========================================
    // SUPER ADMIN: UPDATE PAYMENT METHOD
    // =========================================

    if (action === "update_payment_method") {
      if (!isSuperAdmin) {
        return response({ error: "Super Admin access required" }, 403);
      }

      const methodId = String(body.payment_method_id ?? "").trim();

      if (!isValidUuid(methodId)) {
        return response({ error: "Valid payment method ID is required" }, 400);
      }

      const allowedFields = [
        "method_name",
        "account_name",
        "admin_payment_number",
        "wallet_address",
        "network",
        "method_logo_url",
        "instructions",
        "min_deposit",
        "max_deposit",
        "is_active",
      ];

      const updates: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return response({ error: "No payment method changes supplied" }, 400);
      }

      if (
        updates.is_active !== undefined &&
        typeof updates.is_active !== "boolean"
      ) {
        return response({ error: "is_active must be true or false" }, 400);
      }

      for (const field of [
        "method_name",
        "account_name",
        "admin_payment_number",
        "wallet_address",
        "network",
        "method_logo_url",
        "instructions",
      ]) {
        if (
          updates[field] !== undefined &&
          updates[field] !== null &&
          typeof updates[field] !== "string"
        ) {
          return response({ error: `${field} must be text` }, 400);
        }
      }

      for (const field of ["min_deposit", "max_deposit"]) {
        if (updates[field] !== undefined && updates[field] !== null) {
          const value = Number(updates[field]);

          if (!Number.isFinite(value) || value <= 0) {
            return response({ error: `${field} must be greater than zero` }, 400);
          }

          updates[field] = value;
        }
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("control_payment_method")
        .select("id, method_code, min_deposit, max_deposit")
        .eq("id", methodId)
        .neq("method_code", "GLOBAL")
        .maybeSingle();

      if (existingError || !existing) {
        return response({ error: "Payment method not found" }, 404);
      }

      const minValue = updates.min_deposit !== undefined
        ? updates.min_deposit
        : existing.min_deposit;

      const maxValue = updates.max_deposit !== undefined
        ? updates.max_deposit
        : existing.max_deposit;

      if (
        minValue !== null &&
        maxValue !== null &&
        Number(maxValue) < Number(minValue)
      ) {
        return response({
          error: "Maximum deposit cannot be less than minimum deposit",
        }, 400);
      }

      updates.updated_at = new Date().toISOString();
      updates.updated_by = actor.id;

      const { data: updated, error } = await supabaseAdmin
        .from("control_payment_method")
        .update(updates)
        .eq("id", methodId)
        .select(`
          id,
          method_code,
          method_name,
          method_type,
          account_name,
          admin_payment_number,
          wallet_address,
          network,
          method_logo_url,
          instructions,
          min_deposit,
          max_deposit,
          is_active,
          updated_at
        `)
        .single();

      if (error) {
        console.error("Update payment method error:", error);
        return response({ error: "Could not update payment method" }, 500);
      }

      return response({
        success: true,
        message: "Payment method updated successfully",
        method: updated,
      });
    }

    // =========================================
    // SUPER ADMIN: TOGGLE GLOBAL DEPOSIT
    // =========================================

    if (action === "toggle_deposit_system") {
      if (!isSuperAdmin) {
        return response({ error: "Super Admin access required" }, 403);
      }

      if (typeof body.enabled !== "boolean") {
        return response({ error: "enabled must be true or false" }, 400);
      }

      const maintenanceMessage =
        body.maintenance_message === undefined
          ? undefined
          : String(body.maintenance_message).trim().slice(0, 500);

      const updates: Record<string, unknown> = {
        is_deposit_enabled: body.enabled,
        updated_at: new Date().toISOString(),
        updated_by: actor.id,
      };

      if (maintenanceMessage !== undefined) {
        updates.maintenance_message = maintenanceMessage;
      }

      const { data, error } = await supabaseAdmin
        .from("control_payment_method")
        .update(updates)
        .eq("method_code", "GLOBAL")
        .select("method_code, is_deposit_enabled, maintenance_message, updated_at")
        .single();

      if (error) {
        console.error("Global deposit update error:", error);
        return response({ error: "Could not update deposit settings" }, 500);
      }

      return response({
        success: true,
        message: body.enabled
          ? "Deposit system enabled"
          : "Deposit system disabled",
        settings: data,
      });
    }

    return response({ error: "Invalid action" }, 400);

  } catch (error) {
    console.error("Deposit Manager Error:", error);

    return response({
      error: "Internal server error",
    }, 500);
  }
});
