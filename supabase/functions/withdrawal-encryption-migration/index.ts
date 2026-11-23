
// supabase/functions/withdrawal-encryption-migration/index.ts

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

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

async function getEncryptionKey() {
  if (!encryptionSecret || encryptionSecret.length < 32) {
    throw new Error("Encryption secret is missing or invalid");
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

async function encryptJson(value: any) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return `v1.${toBase64(iv)}.${toBase64(
    new Uint8Array(encrypted)
  )}`;
}

async function decryptJson(value: string) {
  const parts = String(value ?? "").split(".");

  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("Unsupported encrypted data format");
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

function canonicalize(value: any): any {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    const result: any = {};

    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalize(value[key]);
    }

    return result;
  }

  return value;
}

function sameJson(a: any, b: any) {
  return JSON.stringify(canonicalize(a)) ===
    JSON.stringify(canonicalize(b));
}

function getAccountData(row: any) {
  const result: any = {};

  for (const field of ACCOUNT_FIELDS) {
    result[field] = row[field] ?? null;
  }

  return result;
}

async function authenticateSuperAdmin(req: Request) {
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
      .select("id, user_role, account_status")
      .eq("id", data.user.id)
      .maybeSingle();

  if (profileError) throw profileError;

  if (!profile) {
    throw new Error("User profile not found");
  }

  if (profile.account_status !== "active") {
    throw new Error("Account is not active");
  }

  if (profile.user_role !== "super_admin") {
    throw new Error("Super Admin access required");
  }

  return profile;
}

// =========================================
// MIGRATE OLD WITHDRAWAL ACCOUNTS
// =========================================

async function migrateAccounts() {
  const { data: accounts, error } = await supabaseAdmin
    .from("withdrawal_accounts")
    .select(
      "id, account_holder_name, account_number, bank_name, branch_name, routing_number, account_type, wallet_address, network, encrypted_account_data"
    );

  if (error) throw error;

  let encryptedCount = 0;
  let alreadyEncryptedCount = 0;

  for (const account of accounts ?? []) {
    if (account.encrypted_account_data) {
      alreadyEncryptedCount++;
      continue;
    }

    const accountData = getAccountData(account);
    const encrypted = await encryptJson(accountData);

    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from("withdrawal_accounts")
        .update({
          encrypted_account_data: encrypted,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)
        .is("encrypted_account_data", null)
        .select("id")
        .maybeSingle();

    if (updateError) throw updateError;

    if (updated) {
      encryptedCount++;
    } else {
      alreadyEncryptedCount++;
    }
  }

  return {
    total: accounts?.length ?? 0,
    encrypted_now: encryptedCount,
    already_encrypted: alreadyEncryptedCount,
  };
}

// =========================================
// MIGRATE OLD WITHDRAWAL SNAPSHOTS
// =========================================

async function migrateSnapshots() {
  const { data: snapshots, error } = await supabaseAdmin
    .from("withdrawal_account_snapshots")
    .select("id, account_snapshot, encrypted_account_snapshot");

  if (error) throw error;

  let encryptedCount = 0;
  let alreadyEncryptedCount = 0;

  for (const snapshot of snapshots ?? []) {
    if (snapshot.encrypted_account_snapshot) {
      alreadyEncryptedCount++;
      continue;
    }

    const snapshotData = snapshot.account_snapshot;

    if (
      snapshotData === null ||
      typeof snapshotData !== "object" ||
      Array.isArray(snapshotData)
    ) {
      throw new Error(
        `Invalid legacy snapshot data: ${snapshot.id}`
      );
    }

    const encrypted = await encryptJson(snapshotData);

    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from("withdrawal_account_snapshots")
        .update({
          encrypted_account_snapshot: encrypted,
        })
        .eq("id", snapshot.id)
        .is("encrypted_account_snapshot", null)
        .select("id")
        .maybeSingle();

    if (updateError) throw updateError;

    if (updated) {
      encryptedCount++;
    } else {
      alreadyEncryptedCount++;
    }
  }

  return {
    total: snapshots?.length ?? 0,
    encrypted_now: encryptedCount,
    already_encrypted: alreadyEncryptedCount,
  };
}

// =========================================
// VERIFY ENCRYPTED ACCOUNT DATA
// =========================================

async function verifyAccounts() {
  const { data: accounts, error } = await supabaseAdmin
    .from("withdrawal_accounts")
    .select(
      "id, account_holder_name, account_number, bank_name, branch_name, routing_number, account_type, wallet_address, network, encrypted_account_data"
    );

  if (error) throw error;

  let verified = 0;
  const failures: string[] = [];

  for (const account of accounts ?? []) {
    try {
      if (!account.encrypted_account_data) {
        throw new Error("Encrypted data is missing");
      }

      const decrypted = await decryptJson(
        account.encrypted_account_data
      );

      const original = getAccountData(account);

      if (!sameJson(decrypted, original)) {
        throw new Error("Decrypted data does not match");
      }

      verified++;
    } catch {
      failures.push(account.id);
    }
  }

  return {
    total: accounts?.length ?? 0,
    verified,
    failed: failures.length,
    failed_ids: failures,
  };
}

// =========================================
// VERIFY ENCRYPTED SNAPSHOTS
// =========================================

async function verifySnapshots() {
  const { data: snapshots, error } = await supabaseAdmin
    .from("withdrawal_account_snapshots")
    .select("id, account_snapshot, encrypted_account_snapshot");

  if (error) throw error;

  let verified = 0;
  const failures: string[] = [];

  for (const snapshot of snapshots ?? []) {
    try {
      if (!snapshot.encrypted_account_snapshot) {
        throw new Error("Encrypted snapshot is missing");
      }

      const decrypted = await decryptJson(
        snapshot.encrypted_account_snapshot
      );

      if (!sameJson(decrypted, snapshot.account_snapshot)) {
        throw new Error("Decrypted snapshot does not match");
      }

      verified++;
    } catch {
      failures.push(snapshot.id);
    }
  }

  return {
    total: snapshots?.length ?? 0,
    verified,
    failed: failures.length,
    failed_ids: failures,
  };
}

// =========================================
// EDGE FUNCTION ENTRY
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
        { error: "Encryption secret is missing or invalid" },
        500
      );
    }

    await authenticateSuperAdmin(req);

    const body = await req.json();
    const action = String(body.action ?? "").trim();

    if (action === "migrate_legacy") {
      const accountResult = await migrateAccounts();
      const snapshotResult = await migrateSnapshots();

      return response({
        success: true,
        message: "Legacy encryption migration completed",
        accounts: accountResult,
        snapshots: snapshotResult,
        plaintext_preserved: true,
        next_step: "Run verify_legacy before making any database changes",
      });
    }

    if (action === "verify_legacy") {
      const accountResult = await verifyAccounts();
      const snapshotResult = await verifySnapshots();

      const success =
        accountResult.failed === 0 &&
        snapshotResult.failed === 0 &&
        accountResult.verified === accountResult.total &&
        snapshotResult.verified === snapshotResult.total;

      return response({
        success,
        accounts: accountResult,
        snapshots: snapshotResult,
        plaintext_preserved: true,
        message: success
          ? "All legacy encrypted data verified successfully"
          : "Verification failed. Do not delete or modify plaintext data.",
      });
    }

    return response({ error: "Invalid action" }, 400);
  } catch (error) {
    return response(
      { error: error.message ?? "Internal server error" },
      400
    );
  }
});
