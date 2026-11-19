
// @ts-nocheck

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

function response(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

function validAmount(value: any) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 1000000000;
}

function validUuid(value: any) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid PIN hash format");
  }

  const result = new Uint8Array(hex.length / 2);

  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return result;
}

async function verifySecretPin(pin: string, storedHash: string) {
  const parts = String(storedHash ?? "").split("$");

  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2_sha256" ||
    parts[1] !== "210000"
  ) {
    return false;
  }

  const saltHex = parts[2];
  const expectedHex = parts[3];

  if (
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]{64}$/i.test(expectedHex)
  ) {
    return false;
  }

  const salt = fromHex(saltHex);
  const expected = fromHex(expectedHex);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 210000,
      hash: "SHA-256",
    },
    key,
    256
  );

  const actual = new Uint8Array(derived);

  let difference = 0;

  for (let i = 0; i < expected.length; i++) {
    difference |= actual[i] ^ expected[i];
  }

  return difference === 0;
}

async function authenticate(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    throw new Error("Authentication required");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid or expired session");
  }

  const { data: profile, error: profileError } =
    await supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, user_mobile, lottery_id, balance, account_status, user_role, user_secret_pin"
      )
      .eq("id", data.user.id)
      .maybeSingle();

  if (profileError) throw profileError;

  if (!profile) {
    throw new Error("User profile not found");
  }

  if (profile.account_status !== "active") {
    throw new Error("Your account is not active");
  }

  return profile;
}

function requireAdmin(profile: any) {
  if (!["admin", "super_admin"].includes(profile.user_role)) {
    throw new Error("Admin access required");
  }
}

function requireSuperAdmin(profile: any) {
  if (profile.user_role !== "super_admin") {
    throw new Error("Super Admin access required");
  }
}

async function getWithdrawalSettings() {
  const { data, error } = await supabaseAdmin
    .from("withdrawal_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) throw error;

  return data;
}

async function generateTrackingId() {
  const random = crypto.getRandomValues(new Uint32Array(2));

  return (
    "WD" +
    Date.now().toString(36).toUpperCase() +
    random[0].toString(36).toUpperCase() +
    random[1].toString(36).toUpperCase()
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return response(
        { error: "Supabase environment configuration is missing" },
        500
      );
    }

    const profile = await authenticate(req);
    const body = await req.json();
    const action = String(body.action ?? "").trim();

    // =========================================
    // USER: GET METHODS AND GLOBAL SETTINGS
    // =========================================

    if (action === "get_methods") {
      const [methodsResult, settings] = await Promise.all([
        supabaseAdmin
          .from("withdrawal_payment_methods")
          .select("*")
          .order("method_name"),
        getWithdrawalSettings(),
      ]);

      if (methodsResult.error) throw methodsResult.error;

      return response({
        methods: methodsResult.data,
        settings,
      });
    }

    // =========================================
    // USER: LIST SAVED ACCOUNTS
    // =========================================

    if (action === "list_accounts") {
      const { data, error } = await supabaseAdmin
        .from("withdrawal_accounts")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return response({ accounts: data });
    }

    // =========================================
    // USER: SAVE WITHDRAWAL ACCOUNT
    // =========================================

    if (action === "save_account") {
      const accountId = body.account_id
        ? String(body.account_id)
        : null;

      const methodCode = String(
        body.payment_method_code ?? ""
      ).trim();

      const allowedMethods = ["bkash", "nagad", "bank", "usdt"];

      if (!allowedMethods.includes(methodCode)) {
        return response({ error: "Invalid payment method" }, 400);
      }

      if (accountId && !validUuid(accountId)) {
        return response({ error: "Invalid account ID" }, 400);
      }

      const { data: method, error: methodError } =
        await supabaseAdmin
          .from("withdrawal_payment_methods")
          .select("id, is_enabled")
          .eq("method_code", methodCode)
          .maybeSingle();

      if (methodError) throw methodError;

      if (!method || !method.is_enabled) {
        return response(
          { error: "This withdrawal method is unavailable" },
          403
        );
      }

      const account = {
        user_id: profile.id,
        payment_method_code: methodCode,
        account_holder_name: String(
          body.account_holder_name ?? ""
        ).trim() || null,
        account_number: String(
          body.account_number ?? ""
        ).trim() || null,
        bank_name: String(body.bank_name ?? "").trim() || null,
        branch_name: String(body.branch_name ?? "").trim() || null,
        routing_number: String(
          body.routing_number ?? ""
        ).trim() || null,
        account_type: String(
          body.account_type ?? ""
        ).trim().toLowerCase() || null,
        wallet_address: String(
          body.wallet_address ?? ""
        ).trim() || null,
        network: String(body.network ?? "").trim() || null,
        is_default: body.is_default === true,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (methodCode === "bkash" || methodCode === "nagad") {
        if (!account.account_holder_name || !account.account_number) {
          return response(
            { error: "Account holder name and account number are required" },
            400
          );
        }
      }

      if (methodCode === "bank") {
        if (
          !account.bank_name ||
          !account.branch_name ||
          !account.account_holder_name ||
          !account.account_number ||
          !account.routing_number ||
          !["savings", "current"].includes(account.account_type)
        ) {
          return response(
            { error: "All required bank account details must be provided" },
            400
          );
        }
      }

      if (methodCode === "usdt") {
        if (!account.wallet_address || !account.network) {
          return response(
            { error: "Wallet address and network are required" },
            400
          );
        }
      }

      if (accountId) {
        const { data: existing, error: existingError } =
          await supabaseAdmin
            .from("withdrawal_accounts")
            .select("id")
            .eq("id", accountId)
            .eq("user_id", profile.id)
            .maybeSingle();

        if (existingError) throw existingError;

        if (!existing) {
          return response({ error: "Account not found" }, 404);
        }

        const { data, error } = await supabaseAdmin
          .from("withdrawal_accounts")
          .update(account)
          .eq("id", accountId)
          .eq("user_id", profile.id)
          .select()
          .single();

        if (error) throw error;

        return response({
          message: "Withdrawal account updated",
          account: data,
        });
      }

      const { data, error } = await supabaseAdmin
        .from("withdrawal_accounts")
        .insert(account)
        .select()
        .single();

      if (error) throw error;

      return response({
        message: "Withdrawal account saved",
        account: data,
      });
    }

    // =========================================
    // USER: DELETE SAVED ACCOUNT
    // =========================================

    if (action === "delete_account") {
      const accountId = String(body.account_id ?? "");

      if (!validUuid(accountId)) {
        return response({ error: "Invalid account ID" }, 400);
      }

      const { error } = await supabaseAdmin
        .from("withdrawal_accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", profile.id);

      if (error) throw error;

      return response({ message: "Withdrawal account deleted" });
    }

    // =========================================
    // USER: CREATE WITHDRAWAL REQUEST
    // =========================================

    if (action === "create_request") {
      const accountId = String(body.account_id ?? "");
      const amount = Number(body.amount);
      const pin = String(body.secret_pin ?? "");

      if (!validUuid(accountId) || !validAmount(amount)) {
        return response(
          { error: "Valid account and withdrawal amount are required" },
          400
        );
      }

      if (!/^\d{4}$/.test(pin)) {
        return response({ error: "Invalid Secret PIN" }, 400);
      }

      if (!profile.user_secret_pin) {
        return response(
          { error: "Secret PIN is not configured" },
          403
        );
      }

      const pinValid = await verifySecretPin(
        pin,
        profile.user_secret_pin
      );

      if (!pinValid) {
        return response({ error: "Incorrect Secret PIN" }, 401);
      }

      const settings = await getWithdrawalSettings();

      if (!settings.is_withdrawal_enabled) {
        return response(
          {
            error:
              settings.maintenance_message ||
              "Withdrawal is currently unavailable",
          },
          403
        );
      }

      const { data: account, error: accountError } =
        await supabaseAdmin
          .from("withdrawal_accounts")
          .select("*")
          .eq("id", accountId)
          .eq("user_id", profile.id)
          .eq("is_active", true)
          .maybeSingle();

      if (accountError) throw accountError;

      if (!account) {
        return response(
          { error: "Withdrawal account not found" },
          404
        );
      }

      const { data: method, error: methodError } =
        await supabaseAdmin
          .from("withdrawal_payment_methods")
          .select("*")
          .eq("method_code", account.payment_method_code)
          .maybeSingle();

      if (methodError) throw methodError;

      if (!method || !method.is_enabled) {
        return response(
          {
            error:
              method?.maintenance_message ||
              "This withdrawal method is unavailable",
          },
          403
        );
      }

      if (
        amount < Number(method.min_withdrawal) ||
        amount > Number(method.max_withdrawal)
      ) {
        return response(
          { error: "Withdrawal amount is outside the allowed limits" },
          400
        );
      }

      const trackingId = await generateTrackingId();

      // Atomic database RPC.
      // SQL function will lock balance, debit wallet,
      // create request, and save immutable account snapshot.

      const { data, error } = await supabaseAdmin.rpc(
        "withdrawal_create_request",
        {
          p_user_id: profile.id,
          p_account_id: accountId,
          p_amount: amount,
          p_tracking_id: trackingId,
        }
      );

      if (error) throw error;

      return response({
        message: "Withdrawal request submitted successfully",
        withdrawal: data,
      });
    }

    // =========================================
    // USER: OWN WITHDRAWAL HISTORY
    // =========================================

    if (action === "my_history") {
      const { data, error } = await supabaseAdmin
        .from("withdrawal_transactions")
        .select(`
          *,
          withdrawal_account_snapshots (
            payment_method_code,
            account_snapshot,
            created_at
          )
        `)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return response({ history: data });
    }

    // =========================================
    // ADMIN: ALL WITHDRAWAL REQUESTS
    // =========================================

    if (action === "admin_list") {
      requireAdmin(profile);

      const status = String(body.status ?? "").trim();

      let query = supabaseAdmin
        .from("withdrawal_transactions")
        .select(`
          *,
          profiles:user_id (
            full_name,
            user_mobile,
            lottery_id
          ),
          withdrawal_account_snapshots (
            payment_method_code,
            account_snapshot
          )
        `)
        .order("created_at", { ascending: false });

      if (["pending", "approved", "rejected"].includes(status)) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return response({ withdrawals: data });
    }

    // =========================================
    // ADMIN: APPROVE / REJECT
    // =========================================

    if (action === "review_request") {
      requireAdmin(profile);

      const withdrawalId = String(body.withdrawal_id ?? "");
      const decision = String(body.decision ?? "").trim();
      const adminNote = String(body.admin_note ?? "").trim();
      const rejectionReason = String(
        body.rejection_reason ?? ""
      ).trim();

      if (!validUuid(withdrawalId)) {
        return response({ error: "Invalid withdrawal ID" }, 400);
      }

      if (!["approved", "rejected"].includes(decision)) {
        return response(
          { error: "Decision must be approved or rejected" },
          400
        );
      }

      if (decision === "rejected" && !rejectionReason) {
        return response(
          { error: "Rejection reason is required" },
          400
        );
      }

      // Atomic RPC: checks pending status and performs
      // approval or exactly-once refund.

      const { data, error } = await supabaseAdmin.rpc(
        "withdrawal_review_request",
        {
          p_withdrawal_id: withdrawalId,
          p_admin_id: profile.id,
          p_decision: decision,
          p_admin_note: adminNote || null,
          p_rejection_reason: rejectionReason || null,
        }
      );

      if (error) throw error;

      return response({
        message: `Withdrawal ${decision} successfully`,
        withdrawal: data,
      });
    }

    // =========================================
    // SUPER ADMIN: UPDATE GLOBAL SETTINGS
    // =========================================

    if (action === "update_global_settings") {
      requireSuperAdmin(profile);

      const enabled = body.is_withdrawal_enabled;

      if (typeof enabled !== "boolean") {
        return response(
          { error: "A valid enabled/disabled value is required" },
          400
        );
      }

      const { data, error } = await supabaseAdmin
        .from("withdrawal_settings")
        .update({
          is_withdrawal_enabled: enabled,
          maintenance_message:
            String(body.maintenance_message ?? "").trim() || null,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1)
        .select()
        .single();

      if (error) throw error;

      return response({
        message: "Global withdrawal settings updated",
        settings: data,
      });
    }

    // =========================================
    // SUPER ADMIN: UPDATE PAYMENT METHOD
    // =========================================

    if (action === "update_method") {
      requireSuperAdmin(profile);

      const methodId = String(body.method_id ?? "");

      if (!validUuid(methodId)) {
        return response({ error: "Invalid method ID" }, 400);
      }

      const updates: any = {
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      };

      if (typeof body.is_enabled === "boolean") {
        updates.is_enabled = body.is_enabled;
      }

      if (body.min_withdrawal !== undefined) {
        const value = Number(body.min_withdrawal);

        if (!Number.isFinite(value) || value < 0) {
          return response(
            { error: "Invalid minimum withdrawal amount" },
            400
          );
        }

        updates.min_withdrawal = value;
      }

      if (body.max_withdrawal !== undefined) {
        const value = Number(body.max_withdrawal);

        if (!Number.isFinite(value) || value < 0) {
          return response(
            { error: "Invalid maximum withdrawal amount" },
            400
          );
        }

        updates.max_withdrawal = value;
      }

      if (
        updates.min_withdrawal !== undefined &&
        updates.max_withdrawal !== undefined &&
        updates.max_withdrawal < updates.min_withdrawal
      ) {
        return response(
          { error: "Maximum cannot be less than minimum" },
          400
        );
      }

      if (body.withdrawal_instructions !== undefined) {
        updates.withdrawal_instructions =
          String(body.withdrawal_instructions).trim() || null;
      }

      if (body.maintenance_message !== undefined) {
        updates.maintenance_message =
          String(body.maintenance_message).trim() || null;
      }

      const { data, error } = await supabaseAdmin
        .from("withdrawal_payment_methods")
        .update(updates)
        .eq("id", methodId)
        .select()
        .single();

      if (error) throw error;

      return response({
        message: "Withdrawal method updated",
        method: data,
      });
    }

    return response({ error: "Invalid action" }, 400);

  } catch (error) {
    console.error("Withdrawal Manager Error:", error);

    return response(
      { error: error.message ?? "Internal server error" },
      400
    );
  }
});
