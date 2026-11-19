
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

// Diagnostic logging: never log tokens, passwords or secret keys.
function logDiagnostic(step: string, details?: unknown) {
  console.error("[DEPOSIT-MANAGER]", {
    step,
    details: details ?? null,
    time: new Date().toISOString(),
  });
}

function logDatabaseError(step: string, error: any) {
  logDiagnostic(step, {
    message: error?.message ?? "Unknown database error",
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
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
  let diagnosticStep = "request_received";

  logDiagnostic("Request received", {
    method: req.method,
    pathname: new URL(req.url).pathname,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    diagnosticStep = "environment_configuration";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      logDiagnostic("Environment configuration missing", {
        project_url_present: Boolean(supabaseUrl),
        service_key_present: Boolean(serviceRoleKey),
        anon_key_present: Boolean(anonKey),
      });

      return response(
        { error: "Supabase environment configuration is missing" },
        500
      );
    }

    diagnosticStep = "authorization_header";

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return response({ error: "Authentication required" }, 401);
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return response({ error: "Invalid access token" }, 401);
    }

    diagnosticStep = "verify_user_session";

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
      logDiagnostic("User session verification failed", {
        message: authError?.message ?? "User not found",
        code: authError?.code ?? null,
      });

      return response({ error: "Invalid or expired session" }, 401);
    }

    diagnosticStep = "create_database_clients";

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

    diagnosticStep = "load_user_profile";

    const { data: actor, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_role, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (actorError) {
      logDatabaseError("Load user profile failed", actorError);

      logDiagnostic("403_PROFILE_QUERY_FAILED", {
        user_id: user.id,
      });

      return response({ error: "User profile not found" }, 403);
    }

    if (!actor) {
      logDiagnostic("403_PROFILE_NOT_FOUND", {
        user_id: user.id,
      });

      return response({ error: "User profile not found" }, 403);
    }

    if (actor.account_status !== "active") {
      logDiagnostic("403_ACCOUNT_NOT_ACTIVE", {
        account_status: actor.account_status,
        user_id: user.id,
      });

      return response({ error: "Account is not active" }, 403);
    }

    diagnosticStep = "parse_request_body";

    const body = await req.json();
    const action = String(body.action ?? "").trim();

    logDiagnostic("Action received", { action });

    const isAdmin = ["admin", "super_admin"].includes(actor.user_role);
    const isSuperAdmin = actor.user_role === "super_admin";

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
      diagnosticStep = "get_payment_methods_global_settings";

      const { data: global, error: globalError } =
        await getGlobalSettings();

      if (globalError) {
        logDatabaseError("Get payment methods: GLOBAL settings query failed", globalError);
        return response({ error: "Deposit settings unavailable" }, 500);
      }

      if (!global) {
        logDiagnostic("Get payment methods: GLOBAL row not found");
        return response({ error: "Deposit settings unavailable" }, 500);
      }

      diagnosticStep = "get_payment_methods_list";

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
        logDatabaseError("Get payment methods: methods query failed", error);
        return response({ error: "Could not load payment methods" }, 500);
      }

      logDiagnostic("Get payment methods successful", {
        method_count: methods?.length ?? 0,
        deposit_enabled: global.is_deposit_enabled,
      });

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
      diagnosticStep = "create_deposit_validation";

      if (actor.user_role !== "user") {
        logDiagnostic("403_USER_ROLE_REJECTED", {
          user_role: actor.user_role,
          user_id: user.id,
        });

        return response({ error: "This action is for users only" }, 403);
      }

      const methodId = String(body.payment_method_id ?? "").trim();
      const amount = validAmount(body.amount);
      const transactionId = String(body.transaction_id ?? "").trim();
      const senderAccount = String(body.sender_account ?? "").trim();

      logDiagnostic("CREATE_DEPOSIT_INPUT", {
        payment_method_id: methodId,
        amount_valid: amount !== null,
        transaction_id_present: Boolean(transactionId),
        sender_account_present: Boolean(senderAccount),
      });

      if (!isValidUuid(methodId)) {
        logDiagnostic("CREATE_DEPOSIT_INVALID_METHOD_ID", {
          payment_method_id: methodId,
        });

        return response({ error: "Valid payment method is required" }, 400);
      }

      if (amount === null) {
        logDiagnostic("CREATE_DEPOSIT_INVALID_AMOUNT");
        return response({ error: "Invalid deposit amount" }, 400);
      }

      if (transactionId.length < 3 || transactionId.length > 120) {
        logDiagnostic("CREATE_DEPOSIT_INVALID_TRANSACTION_ID", {
          length: transactionId.length,
        });

        return response({ error: "Transaction ID must be 3 to 120 characters" }, 400);
      }

      if (senderAccount.length > 120) {
        logDiagnostic("CREATE_DEPOSIT_SENDER_ACCOUNT_TOO_LONG");
        return response({ error: "Sender account is too long" }, 400);
      }

      diagnosticStep = "create_deposit_global_settings";

      const { data: global, error: globalError } =
        await getGlobalSettings();

      if (globalError) {
        logDatabaseError("Create deposit: GLOBAL settings query failed", globalError);
        return response({ error: "Deposit settings unavailable" }, 500);
      }

      if (!global) {
        logDiagnostic("CREATE_DEPOSIT_GLOBAL_ROW_NOT_FOUND");
        return response({ error: "Deposit settings unavailable" }, 500);
      }

      if (!global.is_deposit_enabled) {
        logDiagnostic("403_DEPOSIT_SYSTEM_DISABLED", {
          is_deposit_enabled: global.is_deposit_enabled,
          maintenance_message: global.maintenance_message,
        });

        return response({
          error: global.maintenance_message ||
            "Deposit service is temporarily unavailable",
        }, 403);
      }

      diagnosticStep = "create_deposit_payment_method";

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

      if (methodError) {
        logDatabaseError("Create deposit: payment method query failed", methodError);
        return response({ error: "Payment method not found" }, 404);
      }

      if (!method) {
        logDiagnostic("CREATE_DEPOSIT_METHOD_NOT_FOUND", {
          payment_method_id: methodId,
        });

        return response({ error: "Payment method not found" }, 404);
      }

      if (!method.is_active || method.method_code === "GLOBAL") {
        logDiagnostic("403_PAYMENT_METHOD_UNAVAILABLE", {
          method_code: method.method_code,
          is_active: method.is_active,
        });

        return response({ error: "Payment method is unavailable" }, 403);
      }

      const paymentDetailsReady =
        method.method_type === "crypto"
          ? Boolean(method.wallet_address?.trim())
          : Boolean(method.admin_payment_number?.trim());

      if (!paymentDetailsReady) {
        logDiagnostic("403_PAYMENT_DETAILS_MISSING", {
          method_code: method.method_code,
          method_type: method.method_type,
          wallet_address_present: Boolean(method.wallet_address?.trim()),
          admin_payment_number_present: Boolean(method.admin_payment_number?.trim()),
        });

        return response({
          error: "This payment method is not configured yet",
        }, 403);
      }

      if (
        method.min_deposit !== null &&
        amount < Number(method.min_deposit)
      ) {
        logDiagnostic("CREATE_DEPOSIT_BELOW_MINIMUM", {
          method_code: method.method_code,
          min_deposit: method.min_deposit,
          submitted_amount: amount,
        });

        return response({
          error: `Minimum deposit is ${method.min_deposit}`,
        }, 400);
      }

      if (
        method.max_deposit !== null &&
        amount > Number(method.max_deposit)
      ) {
        logDiagnostic("CREATE_DEPOSIT_ABOVE_MAXIMUM", {
          method_code: method.method_code,
          max_deposit: method.max_deposit,
          submitted_amount: amount,
        });

        return response({
          error: `Maximum deposit is ${method.max_deposit}`,
        }, 400);
      }

      diagnosticStep = "insert_deposit_request";

      logDiagnostic("CREATE_DEPOSIT_INSERT_STARTED", {
        user_id: user.id,
        method_code: method.method_code,
        amount,
      });

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
          logDiagnostic("CREATE_DEPOSIT_DUPLICATE_TRANSACTION", {
            code: insertError.code,
          });

          return response({
            error: "This transaction ID has already been used",
          }, 409);
        }

        logDatabaseError("Insert deposit request failed", insertError);
        return response({ error: "Could not create deposit request" }, 500);
      }

      logDiagnostic("CREATE_DEPOSIT_SUCCESS", {
        deposit_id: deposit.id,
        deposit_tracking_id: deposit.deposit_tracking_id,
      });

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
      diagnosticStep = "load_my_deposit_history";

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
        logDatabaseError("Deposit history query failed", error);
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
      diagnosticStep = "admin_deposit_list";

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
        logDatabaseError("Admin deposit list query failed", error);
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
      diagnosticStep = "approve_deposit";

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
        logDatabaseError("Approve deposit RPC failed", error);
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
      diagnosticStep = "reject_deposit";

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
        logDatabaseError("Reject deposit RPC failed", error);
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
      diagnosticStep = "update_payment_method";

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

      if (existingError) {
        logDatabaseError("Update payment method: load existing method failed", existingError);
        return response({ error: "Payment method not found" }, 404);
      }

      if (!existing) {
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
        logDatabaseError("Update payment method failed", error);
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
      diagnosticStep = "toggle_deposit_system";

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
        logDatabaseError("Toggle deposit system failed", error);
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

    logDiagnostic("Invalid action received", { action });
    return response({ error: "Invalid action" }, 400);

  } catch (error) {
    const errorDetails = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack ?? null,
        }
      : {
          message: String(error),
        };

    logDiagnostic(`UNHANDLED ERROR at step: ${diagnosticStep}`, errorDetails);

    return response({
      error: "Internal server error",
    }, 500);
  }
});
