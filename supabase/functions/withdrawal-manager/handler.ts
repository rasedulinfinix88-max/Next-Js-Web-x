
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
const encryptionSecret = Deno.env.get("WITHDRAWAL_ENCRYPTION_KEY") ?? "";

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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ACCOUNT_FIELDS = [
  "account_holder_name",
  "account_number",
  "bank_name",
  "branch_name",
  "routing_number",
  "account_type",
  "wallet_address",
  "network",
];

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

// =========================================
// AES-256-GCM ENCRYPTION
// =========================================

async function getEncryptionKey() {
  if (!encryptionSecret || encryptionSecret.length < 32) {
    throw new Error("Withdrawal encryption configuration is missing");
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(encryptionSecret)
  );

  return await crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBase64(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function encryptJson(value: any) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(value))
  );

  return `v1.${toBase64(iv)}.${toBase64(
    new Uint8Array(encrypted)
  )}`;
}

async function decryptJson(value: string) {
  const parts = String(value ?? "").split(".");

  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted account data");
  }

  const key = await getEncryptionKey();
  const iv = fromBase64(parts[1]);
  const ciphertext = fromBase64(parts[2]);

  if (iv.length !== 12) {
    throw new Error("Invalid encryption IV");
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return JSON.parse(decoder.decode(decrypted));
}

// =========================================
// ACCOUNT DATA VALIDATION
// =========================================

function normalizeAccountData(methodCode: string, body: any) {
  const account = {
    account_holder_name:
      String(body.account_holder_name ?? "").trim() || null,

    account_number:
      String(body.account_number ?? "").trim() || null,

    bank_name:
      String(body.bank_name ?? "").trim() || null,

    branch_name:
      String(body.branch_name ?? "").trim() || null,

    routing_number:
      String(body.routing_number ?? "").trim() || null,

    account_type:
      String(body.account_type ?? "").trim().toLowerCase() || null,

    wallet_address:
      String(body.wallet_address ?? "").trim() || null,

    network:
      String(body.network ?? "").trim() || null,
  };

  if (methodCode === "bkash" || methodCode === "nagad") {
    if (!account.account_holder_name || !account.account_number) {
      throw new Error(
        "Account holder name and account number are required"
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
      throw new Error(
        "All required bank account details must be provided"
      );
    }
  }

  if (methodCode === "usdt") {
    if (!account.wallet_address || !account.network) {
      throw new Error("Wallet address and network are required");
    }
  }

  return account;
}

async function decryptAccountRow(row: any) {
  if (!row.encrypted_account_data) {
    throw new Error("Encrypted account data is unavailable");
  }

  const decrypted = await decryptJson(row.encrypted_account_data);

  const result: any = {};

  for (const field of ACCOUNT_FIELDS) {
    result[field] = decrypted[field] ?? null;
  }

  const {
    encrypted_account_data,
    ...safeMetadata
  } = row;

  return {
    ...safeMetadata,
    ...result,
  };
}

// =========================================
// SNAPSHOT DECRYPTION
// =========================================

async function decryptSnapshotRow(row: any) {
  let snapshot: any = {};

  if (row.encrypted_account_snapshot) {
    snapshot = await decryptJson(row.encrypted_account_snapshot);
  } else if (
    row.account_snapshot &&
    typeof row.account_snapshot === "object" &&
    !Array.isArray(row.account_snapshot)
  ) {
    // Preserve legacy plaintext snapshots.
    snapshot = row.account_snapshot;
  }

  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot)
  ) {
    snapshot = {};
  }

  const {
    encrypted_account_snapshot,
    ...safeRow
  } = row;

  return {
    ...safeRow,
    account_snapshot: snapshot,
  };
}

async function decryptHistoryRows(rows: any[]) {
  return Promise.all(
    (rows ?? []).map(async (item: any) => {
      const relation = item.withdrawal_account_snapshots;

      if (Array.isArray(relation)) {
        item.withdrawal_account_snapshots = await Promise.all(
          relation.map(decryptSnapshotRow)
        );
      } else if (relation && typeof relation === "object") {
        item.withdrawal_account_snapshots =
          await decryptSnapshotRow(relation);
      } else {
        item.withdrawal_account_snapshots = [];
      }

      return item;
    })
  );
}

// =========================================
// USER RPC CLIENT
// =========================================

function createUserRpcClient(token: string) {
  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// =========================================
// SECRET PIN VERIFICATION
// =========================================

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
    encoder.encode(pin),
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

// =========================================
// AUTHENTICATION
// =========================================

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
        "id, full_name, user_mobile, lottery_id, balance, account_status, user_role, user_secret_pin, user_lottery_fee_paid, user_lottery_is_terms_accepted"
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

// =========================================
// WITHDRAWAL SETTINGS
// =========================================

async function getWithdrawalSettings() {
  const { data, error } = await supabaseAdmin
    .from("withdrawal_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) throw error;

  return data;
}

// =========================================
// WITHDRAWAL ELIGIBILITY
// =========================================

async function checkWithdrawalEligibility(profile: any) {
  if (profile.user_lottery_is_terms_accepted !== true) {
    return {
      eligible: false,
      reason: "terms_not_accepted",
      message: "Withdrawal terms must be accepted first.",
    };
  }

  if (profile.user_lottery_fee_paid !== true) {
    return {
      eligible: false,
      reason: "fee_not_approved",
      message: "Lottery fee payment is not approved yet.",
    };
  }

  const { data: assessments, error: assessmentError } =
    await supabaseAdmin
      .from("lottery_fee_assessments")
      .select("id")
      .eq("winner_user_id", profile.id)
      .eq("payment_status", "approved");

  if (assessmentError) throw assessmentError;

  if (!assessments || assessments.length === 0) {
    return {
      eligible: false,
      reason: "fee_assessment_not_approved",
      message: "Approved fee assessment was not found.",
    };
  }

  const assessmentIds = assessments.map((item: any) => item.id);

  const [paymentsResult, verificationResult] = await Promise.all([
    supabaseAdmin
      .from("lottery_fee_payments")
      .select("assessment_id")
      .in("assessment_id", assessmentIds)
      .eq("user_id", profile.id)
      .eq("status", "approved"),

    supabaseAdmin
      .from("lottery_verification_requests")
      .select("assessment_id")
      .in("assessment_id", assessmentIds)
      .eq("user_id", profile.id)
      .eq("identity_status", "approved")
      .eq("payment_method_status", "approved"),
  ]);

  if (paymentsResult.error) throw paymentsResult.error;
  if (verificationResult.error) throw verificationResult.error;

  const approvedPaymentIds = new Set(
    (paymentsResult.data || []).map((item: any) => item.assessment_id)
  );

  const approvedVerificationIds = new Set(
    (verificationResult.data || []).map(
      (item: any) => item.assessment_id
    )
  );

  const fullyApproved = assessmentIds.some(
    (id: string) =>
      approvedPaymentIds.has(id) &&
      approvedVerificationIds.has(id)
  );

  if (!fullyApproved) {
    return {
      eligible: false,
      reason: "verification_not_approved",
      message:
        "Fee payment, identity verification and payment method verification must all be approved.",
    };
  }

  return {
    eligible: true,
    reason: "approved",
    message: "Withdrawal access approved.",
  };
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

// =========================================
// AUDIT LOG READER
// =========================================

async function getAccountAuditLogs(accountId: string) {
  const { data, error } = await supabaseAdmin
    .from("withdrawal_account_change_audit")
    .select(
      "id, account_id, user_id, changed_by, changed_by_role, change_reason, created_at"
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const logs = data ?? [];

  if (logs.length === 0) {
    return [];
  }

  const profileIds = Array.from(
    new Set(
      logs.flatMap((item: any) => [
        item.user_id,
        item.changed_by,
      ]).filter(Boolean)
    )
  );

  const { data: profiles, error: profilesError } =
    await supabaseAdmin
      .from("profiles")
      .select("id, full_name, user_mobile, lottery_id")
      .in("id", profileIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profiles ?? []).map((item: any) => [item.id, item])
  );

  return logs.map((item: any) => ({
    ...item,
    user_profile: profileMap.get(item.user_id) ?? null,
    changed_by_profile: profileMap.get(item.changed_by) ?? null,
  }));
}

// =========================================
// EDGE FUNCTION
// =========================================

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

    if (!encryptionSecret || encryptionSecret.length < 32) {
      return response(
        { error: "Withdrawal encryption configuration is missing" },
        500
      );
    }

    const profile = await authenticate(req);
    const body = await req.json();
    const action = String(body.action ?? "").trim();

    // =========================================
    // USER: CHECK WITHDRAWAL ELIGIBILITY
    // =========================================

    if (action === "check_withdrawal_eligibility") {
      const eligibility = await checkWithdrawalEligibility(profile);
      return response(eligibility);
    }

    // =========================================
    // USER: GET METHODS AND SETTINGS
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
    // USER: LIST ENCRYPTED ACCOUNTS
    // =========================================

    if (action === "list_accounts") {
      const { data, error } = await supabaseAdmin
        .from("withdrawal_accounts")
        .select(
          "id, user_id, payment_method_code, is_default, is_active, created_at, updated_at, encrypted_account_data"
        )
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const accounts = await Promise.all(
        (data ?? []).map(decryptAccountRow)
      );

      return response({ accounts });
    }

    // =========================================
    // USER: SAVE ACCOUNT - INSERT ONLY
    // =========================================

    if (action === "save_account") {
      if (body.account_id) {
        return response(
          { error: "Saved accounts cannot be edited. Contact support." },
          403
        );
      }

      const methodCode = String(
        body.payment_method_code ?? ""
      ).trim();

      const allowedMethods = ["bkash", "nagad", "bank", "usdt"];

      if (!allowedMethods.includes(methodCode)) {
        return response({ error: "Invalid payment method" }, 400);
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

      let accountData: any;

      try {
        accountData = normalizeAccountData(methodCode, body);
      } catch (error) {
        return response({ error: error.message }, 400);
      }

      const { data: existing, error: existingError } =
        await supabaseAdmin
          .from("withdrawal_accounts")
          .select("id")
          .eq("user_id", profile.id)
          .eq("payment_method_code", methodCode)
          .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        return response(
          {
            error:
              "You already have an account for this payment method. Contact support to change it.",
          },
          409
        );
      }

      const encrypted = await encryptJson(accountData);

      const { data, error } = await supabaseAdmin
        .from("withdrawal_accounts")
        .insert({
          user_id: profile.id,
          payment_method_code: methodCode,

          account_holder_name: null,
          account_number: null,
          bank_name: null,
          branch_name: null,
          routing_number: null,
          account_type: null,
          wallet_address: null,
          network: null,

          encrypted_account_data: encrypted,
          is_default: body.is_default === true,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select(
          "id, user_id, payment_method_code, is_default, is_active, created_at, updated_at, encrypted_account_data"
        )
        .single();

      if (error) {
        if (error.code === "23505") {
          return response(
            { error: "An account for this method already exists" },
            409
          );
        }

        throw error;
      }

      return response({
        message: "Withdrawal account saved successfully",
        account: await decryptAccountRow(data),
      });
    }

    // =========================================
    // USER: DELETE ACCOUNT - DISABLED
    // =========================================

    if (action === "delete_account") {
      return response(
        {
          error:
            "Account deletion is disabled. Contact support for assistance.",
        },
        403
      );
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
          .select(
            "id, user_id, payment_method_code, is_active, encrypted_account_data"
          )
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

      if (!account.encrypted_account_data) {
        return response(
          { error: "Withdrawal account encryption is not ready" },
          409
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
      const userToken = getBearerToken(req);

      if (!userToken) {
        return response(
          { error: "Authentication required" },
          401
        );
      }

      const supabaseUserRpc = createUserRpcClient(userToken);

      const { data, error } = await supabaseUserRpc.rpc(
        "secure_withdrawal_create_request",
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
            encrypted_account_snapshot,
            created_at
          )
        `)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return response({
        history: await decryptHistoryRows(data ?? []),
      });
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
            account_snapshot,
            encrypted_account_snapshot
          )
        `)
        .order("created_at", { ascending: false });

      if (["pending", "approved", "rejected"].includes(status)) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return response({
        withdrawals: await decryptHistoryRows(data ?? []),
      });
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
    // ADMIN: UPDATE PAYMENT METHOD LOGO
    // =========================================

    if (action === "update_method_logo") {
      requireAdmin(profile);

      const methodId = String(body.method_id ?? "");

      if (!validUuid(methodId)) {
        return response({ error: "Invalid method ID" }, 400);
      }

      const logoUrl = String(body.logo_url ?? "").trim();

      if (logoUrl) {
        try {
          const parsed = new URL(logoUrl);

          if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error("Invalid protocol");
          }
        } catch {
          return response(
            { error: "A valid HTTP or HTTPS logo URL is required" },
            400
          );
        }
      }

      const { data, error } = await supabaseAdmin
        .from("withdrawal_payment_methods")
        .update({
          logo_url: logoUrl || null,
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        })
        .eq("id", methodId)
        .select("*")
        .single();

      if (error) throw error;

      return response({
        message: "Payment method logo updated",
        method: data,
      });
    }

    // =========================================
    // SUPER ADMIN: CHANGE USER ACCOUNT
    // =========================================

    if (action === "admin_change_account") {
      requireSuperAdmin(profile);

      const accountId = String(body.account_id ?? "");
      const reason = String(body.change_reason ?? "").trim();

      if (!validUuid(accountId)) {
        return response({ error: "Invalid account ID" }, 400);
      }

      if (reason.length < 5 || reason.length > 1000) {
        return response(
          { error: "A change reason of 5 to 1000 characters is required" },
          400
        );
      }

      const { data: existing, error: existingError } =
        await supabaseAdmin
          .from("withdrawal_accounts")
          .select(
            "id, user_id, payment_method_code, encrypted_account_data"
          )
          .eq("id", accountId)
          .maybeSingle();

      if (existingError) throw existingError;

      if (!existing) {
        return response({ error: "Account not found" }, 404);
      }

      if (!existing.encrypted_account_data) {
        return response(
          { error: "Existing account encryption is missing" },
          409
        );
      }

      const newAccountData = normalizeAccountData(
        existing.payment_method_code,
        body
      );

      const newEncrypted = await encryptJson(newAccountData);

      const { data, error } = await supabaseAdmin.rpc(
        "withdrawal_admin_change_account",
        {
          p_account_id: existing.id,
          p_user_id: existing.user_id,
          p_changed_by: profile.id,
          p_change_reason: reason,
          p_old_encrypted_data: existing.encrypted_account_data,
          p_new_encrypted_data: newEncrypted,
        }
      );

      if (error) throw error;

      return response({
        message: "Account changed and audit record created",
        result: data,
      });
    }

    // =========================================
    // SUPER ADMIN: GET ACCOUNT AUDIT LOG
    // =========================================

    if (action === "get_account_audit") {
      requireSuperAdmin(profile);

      const accountId = String(body.account_id ?? "");

      if (!validUuid(accountId)) {
        return response({ error: "Invalid account ID" }, 400);
      }

      const logs = await getAccountAuditLogs(accountId);

      return response({
        audit_logs: logs,
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
    // Do not log account data, PINs, or encryption secrets.
    console.error("Withdrawal Manager Error:", error.message);

    return response(
      { error: error.message ?? "Internal server error" },
      400
    );
  }
});
