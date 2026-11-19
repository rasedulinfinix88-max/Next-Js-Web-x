
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

const ADMIN_PATH = "/admin-panel-rakib-aiman-tushar";

type PaymentMethod = {
  id: string;
  method_code: string;
  method_name: string | null;
  method_type: string | null;
  account_name: string | null;
  admin_payment_number: string | null;
  wallet_address: string | null;
  network: string | null;
  method_logo_url: string | null;
  instructions: string | null;
  min_deposit: number | null;
  max_deposit: number | null;
  is_active: boolean;
  updated_at?: string | null;
};

type Deposit = {
  id: string;
  user_id: string;
  deposit_tracking_id: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  payment_method_code: string | null;
  amount: number | null;
  transaction_id: string | null;
  sender_account: string | null;
  status: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

type MethodForm = {
  method_name: string;
  account_name: string;
  admin_payment_number: string;
  wallet_address: string;
  network: string;
  method_logo_url: string;
  instructions: string;
  min_deposit: string;
  max_deposit: string;
  is_active: boolean;
};

const emptyMethodForm: MethodForm = {
  method_name: "",
  account_name: "",
  admin_payment_number: "",
  wallet_address: "",
  network: "",
  method_logo_url: "",
  instructions: "",
  min_deposit: "",
  max_deposit: "",
  is_active: true,
};

const inputClass =
  "w-full rounded-lg border border-[#315d45] bg-[#09170f] px-3 py-3 text-sm text-white outline-none focus:border-green-500";

const labelClass = "mb-2 block text-sm text-gray-300";

const cardClass =
  "rounded-xl border border-[#244632] bg-[#10251a] p-4";

export default function DepositManagementPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [loadingDeposits, setLoadingDeposits] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingMethod, setSavingMethod] = useState("");
  const [updatingSystem, setUpdatingSystem] = useState(false);
  const [processingDeposit, setProcessingDeposit] = useState("");

  const [adminRole, setAdminRole] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodForms, setMethodForms] = useState<
    Record<string, MethodForm>
  >({});

  const [depositEnabled, setDepositEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    total_pages: 0,
  });

  const [selectedDeposit, setSelectedDeposit] =
    useState<Deposit | null>(null);

  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const invokeManager = useCallback(
    async (body: Record<string, unknown>) => {
      const { data, error: functionError } =
        await supabase.functions.invoke("deposit-manager", {
          body,
        });

      if (functionError) {
        throw new Error(
          functionError.message || "Could not connect to Deposit Manager"
        );
      }

      if (!data?.success) {
        throw new Error(data?.error || "Request failed");
      }

      return data;
    },
    [supabase]
  );

  const fetchPaymentMethods = useCallback(async () => {
    const data = await invokeManager({
      action: "get_payment_methods",
    });

    const loadedMethods: PaymentMethod[] = data.methods || [];

    setMethods(loadedMethods);
    setDepositEnabled(Boolean(data.deposit_enabled));
    setMaintenanceMessage(data.maintenance_message || "");

    const forms: Record<string, MethodForm> = {};

    loadedMethods.forEach((method) => {
      forms[method.id] = {
        method_name: method.method_name || "",
        account_name: method.account_name || "",
        admin_payment_number: method.admin_payment_number || "",
        wallet_address: method.wallet_address || "",
        network: method.network || "",
        method_logo_url: method.method_logo_url || "",
        instructions: method.instructions || "",
        min_deposit:
          method.min_deposit === null
            ? ""
            : String(method.min_deposit),
        max_deposit:
          method.max_deposit === null
            ? ""
            : String(method.max_deposit),
        is_active: Boolean(method.is_active),
      };
    });

    setMethodForms(forms);
  }, [invokeManager]);

  const fetchDeposits = useCallback(
    async (nextPage = 1) => {
      setLoadingDeposits(true);
      setError("");

      try {
        const body: Record<string, unknown> = {
          action: "admin_deposit_list",
          page: nextPage,
          limit: 25,
        };

        if (statusFilter) {
          body.status = statusFilter;
        }

        const data = await invokeManager(body);

        setDeposits(data.deposits || []);
        setPagination(data.pagination);
        setPage(nextPage);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load deposit requests"
        );
      } finally {
        setLoadingDeposits(false);
      }
    },
    [invokeManager, statusFilter]
  );

  const refreshAll = useCallback(async () => {
    setError("");
    setNotice("");

    try {
      await fetchPaymentMethods();
      await fetchDeposits(1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load deposit information"
      );
    }
  }, [fetchPaymentMethods, fetchDeposits]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const access = await checkAdminAccess();

        if (!active) return;

        if (!access.allowed) {
          router.replace(`${ADMIN_PATH}/Admin-login/`);
          return;
        }

        setAdminRole(access.role || "");

        if (access.role !== "super_admin") {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        await fetchPaymentMethods();

        if (!active) return;

        await fetchDeposits(1);

        if (active) {
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not initialize Deposit Management"
          );
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [router, fetchPaymentMethods, fetchDeposits]);

  function updateMethodForm(
    methodId: string,
    field: keyof MethodForm,
    value: string | boolean
  ) {
    setMethodForms((previous) => ({
      ...previous,
      [methodId]: {
        ...previous[methodId],
        [field]: value,
      },
    }));
  }

  async function savePaymentMethod(method: PaymentMethod) {
    const form = methodForms[method.id];

    if (!form || savingMethod) return;

    const minAmount =
      form.min_deposit.trim() === ""
        ? null
        : Number(form.min_deposit);

    const maxAmount =
      form.max_deposit.trim() === ""
        ? null
        : Number(form.max_deposit);

    if (
      (minAmount !== null && (!Number.isFinite(minAmount) || minAmount < 0)) ||
      (maxAmount !== null && (!Number.isFinite(maxAmount) || maxAmount < 0))
    ) {
      setError("Minimum and maximum deposit amounts must be valid numbers.");
      return;
    }

    if (
      minAmount !== null &&
      maxAmount !== null &&
      maxAmount < minAmount
    ) {
      setError("Maximum deposit amount cannot be lower than minimum amount.");
      return;
    }

    const confirmed = window.confirm(
      `Save ${method.method_name || method.method_code} payment settings?`
    );

    if (!confirmed) return;

    setSavingMethod(method.id);
    setError("");
    setNotice("");

    try {
      await invokeManager({
        action: "update_payment_method",
        payment_method_id: method.id,
        method_name: form.method_name.trim(),
        account_name: form.account_name.trim(),
        admin_payment_number: form.admin_payment_number.trim(),
        wallet_address: form.wallet_address.trim(),
        network: form.network.trim(),
        method_logo_url: form.method_logo_url.trim(),
        instructions: form.instructions.trim(),
        min_deposit: minAmount,
        max_deposit: maxAmount,
        is_active: form.is_active,
      });

      setNotice(
        `${method.method_name || method.method_code} settings updated successfully.`
      );

      await fetchPaymentMethods();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update payment method"
      );
    } finally {
      setSavingMethod("");
    }
  }

  async function handleDepositSystemToggle() {
    if (updatingSystem) return;

    const nextEnabled = !depositEnabled;

    const confirmed = window.confirm(
      nextEnabled
        ? "Are you sure you want to ENABLE the complete Deposit System?"
        : "Are you sure you want to DISABLE the complete Deposit System?"
    );

    if (!confirmed) return;

    setUpdatingSystem(true);
    setError("");
    setNotice("");

    try {
      await invokeManager({
        action: "toggle_deposit_system",
        enabled: nextEnabled,
        maintenance_message: maintenanceMessage.trim(),
      });

      setDepositEnabled(nextEnabled);

      setNotice(
        nextEnabled
          ? "Deposit System successfully enabled."
          : "Deposit System successfully disabled."
      );

      await fetchPaymentMethods();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update Deposit System"
      );
    } finally {
      setUpdatingSystem(false);
    }
  }

  async function handleApproveDeposit() {
    if (!selectedDeposit || processingDeposit) return;

    const confirmed = window.confirm(
      `Approve this deposit request?\n\n` +
        `Tracking ID: ${selectedDeposit.deposit_tracking_id || "—"}\n` +
        `Amount: ${selectedDeposit.amount ?? 0}`
    );

    if (!confirmed) return;

    setProcessingDeposit(selectedDeposit.id);
    setError("");
    setNotice("");

    try {
      const data = await invokeManager({
        action: "approve_deposit",
        deposit_id: selectedDeposit.id,
        admin_note: adminNote.trim(),
      });

      setNotice(
        data.message ||
          `Deposit approved successfully. New balance: ${data.balance_after ?? "—"}`
      );

      setSelectedDeposit(null);
      setAdminNote("");

      await fetchDeposits(page);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not approve deposit"
      );
    } finally {
      setProcessingDeposit("");
    }
  }

  async function handleRejectDeposit() {
    if (!selectedDeposit || processingDeposit) return;

    if (!rejectionReason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }

    const confirmed = window.confirm(
      `Reject this deposit request?\n\n` +
        `Tracking ID: ${selectedDeposit.deposit_tracking_id || "—"}`
    );

    if (!confirmed) return;

    setProcessingDeposit(selectedDeposit.id);
    setError("");
    setNotice("");

    try {
      const data = await invokeManager({
        action: "reject_deposit",
        deposit_id: selectedDeposit.id,
        rejection_reason: rejectionReason.trim(),
      });

      setNotice(data.message || "Deposit request rejected successfully.");

      setSelectedDeposit(null);
      setRejectionReason("");

      await fetchDeposits(page);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reject deposit"
      );
    } finally {
      setProcessingDeposit("");
    }
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await supabase.auth.signOut();
      router.replace(`${ADMIN_PATH}/Admin-login/`);
    } catch {
      setError("Logout failed. Please try again.");
      setLoggingOut(false);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
  }

  function formatAmount(value: number | null) {
    return Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  function statusClass(status: string | null) {
    if (status === "approved") {
      return "bg-green-950 text-green-300";
    }

    if (status === "rejected") {
      return "bg-red-950 text-red-300";
    }

    return "bg-yellow-950 text-yellow-300";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07140d] text-white">
        <p>Loading Deposit Management...</p>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07140d] p-5 text-white">
        <div className="w-full max-w-md rounded-xl border border-red-800 bg-[#10251a] p-6 text-center">
          <h1 className="text-xl font-bold text-red-400">
            Super Admin Access Required
          </h1>
          <p className="mt-3 text-sm text-gray-400">
            Only Super Admin can control Deposit Management settings.
          </p>
          <button
            type="button"
            onClick={() => router.replace(`${ADMIN_PATH}/User-dashboard/`)}
            className="mt-5 rounded-lg bg-[#218653] px-5 py-3 text-sm font-semibold"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07140d] text-white">
      <header className="flex items-center justify-between border-b border-[#244632] bg-[#10251a] px-4 py-4">
        <div>
          <h1 className="text-lg font-bold text-green-400">
            DEPOSIT MANAGEMENT
          </h1>
          <p className="text-xs text-gray-400">
            Administrator: {adminRole}
          </p>
        </div>

        <AdminMenu
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
      </header>

      <section className="mx-auto max-w-7xl space-y-5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Deposit Control Center</h2>
            <p className="mt-1 text-sm text-gray-400">
              Super Admin control for deposits and payment methods.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            className="shrink-0 rounded-lg border border-[#315d45] px-3 py-2 text-xs font-semibold"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-lg border border-[#315d45] bg-[#10251a] p-3 text-sm text-green-300">
            {notice}
          </div>
        )}

        {/* DEPOSIT SYSTEM GLOBAL CONTROL */}

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-green-400">
                GLOBAL DEPOSIT SYSTEM
              </h3>
              <p className="mt-1 text-xs text-gray-400">
                Control all deposit methods at once.
              </p>
            </div>

            <span
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                depositEnabled
                  ? "bg-green-950 text-green-300"
                  : "bg-red-950 text-red-300"
              }`}
            >
              {depositEnabled ? "SYSTEM ON" : "SYSTEM OFF"}
            </span>
          </div>

          <div className="mt-4">
            <label className={labelClass}>
              Maintenance Message
            </label>

            <textarea
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Deposit service is temporarily unavailable."
              className={inputClass}
            />

            <p className="mt-1 text-right text-xs text-gray-500">
              {maintenanceMessage.length}/500
            </p>
          </div>

          <button
            type="button"
            onClick={handleDepositSystemToggle}
            disabled={updatingSystem}
            className={`mt-3 w-full rounded-lg px-4 py-3 font-bold text-white disabled:opacity-50 ${
              depositEnabled
                ? "bg-red-700 hover:bg-red-600"
                : "bg-green-700 hover:bg-green-600"
            }`}
          >
            {updatingSystem
              ? "Updating System..."
              : depositEnabled
              ? "TURN DEPOSIT SYSTEM OFF"
              : "TURN DEPOSIT SYSTEM ON"}
          </button>
        </div>

        {/* PAYMENT METHODS */}

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">Payment Method Settings</h2>
            <p className="mt-1 text-xs text-gray-400">
              Configure receiving accounts, limits and method status.
            </p>
          </div>

          {methods.length === 0 ? (
            <div className={cardClass}>
              <p className="text-center text-sm text-gray-400">
                No payment methods found.
              </p>
            </div>
          ) : (
            methods.map((method) => {
              const form = methodForms[method.id];

              if (!form) return null;

              const isUsdt = method.method_code === "USDT";

              return (
                <div key={method.id} className={cardClass}>
                  <div className="flex items-center justify-between gap-3 border-b border-[#244632] pb-3">
                    <div>
                      <h3 className="font-bold text-green-400">
                        {method.method_name || method.method_code}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Code: {method.method_code} · {method.method_type}
                      </p>
                    </div>

                    <span
                      className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                        form.is_active
                          ? "bg-green-950 text-green-300"
                          : "bg-red-950 text-red-300"
                      }`}
                    >
                      {form.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className={labelClass}>Method Name</label>
                      <input
                        value={form.method_name}
                        onChange={(e) =>
                          updateMethodForm(
                            method.id,
                            "method_name",
                            e.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </div>

                    {!isUsdt && (
                      <>
                        <div>
                          <label className={labelClass}>
                            Account Holder Name
                          </label>
                          <input
                            value={form.account_name}
                            onChange={(e) =>
                              updateMethodForm(
                                method.id,
                                "account_name",
                                e.target.value
                              )
                            }
                            placeholder="Account holder name"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Receiving Mobile Number
                          </label>
                          <input
                            value={form.admin_payment_number}
                            onChange={(e) =>
                              updateMethodForm(
                                method.id,
                                "admin_payment_number",
                                e.target.value
                              )
                            }
                            placeholder="Enter receiving number"
                            className={inputClass}
                          />
                        </div>
                      </>
                    )}

                    {isUsdt && (
                      <>
                        <div>
                          <label className={labelClass}>
                            USDT Wallet Address
                          </label>
                          <textarea
                            rows={3}
                            value={form.wallet_address}
                            onChange={(e) =>
                              updateMethodForm(
                                method.id,
                                "wallet_address",
                                e.target.value
                              )
                            }
                            placeholder="Enter wallet address"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Network
                          </label>
                          <input
                            value={form.network}
                            onChange={(e) =>
                              updateMethodForm(
                                method.id,
                                "network",
                                e.target.value
                              )
                            }
                            placeholder="Example: TRC20"
                            className={inputClass}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className={labelClass}>
                        Instructions
                      </label>
                      <textarea
                        rows={3}
                        value={form.instructions}
                        onChange={(e) =>
                          updateMethodForm(
                            method.id,
                            "instructions",
                            e.target.value
                          )
                        }
                        placeholder="Payment instructions for users"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        Payment Logo URL
                      </label>
                      <input
                        value={form.method_logo_url}
                        onChange={(e) =>
                          updateMethodForm(
                            method.id,
                            "method_logo_url",
                            e.target.value
                          )
                        }
                        placeholder="https://..."
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>
                          Minimum Deposit
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.min_deposit}
                          onChange={(e) =>
                            updateMethodForm(
                              method.id,
                              "min_deposit",
                              e.target.value
                            )
                          }
                          placeholder="Minimum"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          Maximum Deposit
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.max_deposit}
                          onChange={(e) =>
                            updateMethodForm(
                              method.id,
                              "max_deposit",
                              e.target.value
                            )
                          }
                          placeholder="Maximum"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <label className="flex items-center justify-between rounded-lg border border-[#315d45] bg-[#09170f] p-3">
                      <span className="text-sm font-semibold">
                        Payment Method Active
                      </span>

                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) =>
                          updateMethodForm(
                            method.id,
                            "is_active",
                            e.target.checked
                          )
                        }
                        className="h-5 w-5 accent-green-600"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => savePaymentMethod(method)}
                      disabled={savingMethod !== ""}
                      className="w-full rounded-lg bg-[#218653] px-4 py-3 font-semibold text-white disabled:opacity-50"
                    >
                      {savingMethod === method.id
                        ? "Saving Settings..."
                        : "Save Payment Settings"}
                    </button>

                    <p className="text-[11px] text-gray-500">
                      Last Updated: {formatDate(method.updated_at || null)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DEPOSIT REQUESTS */}

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">Deposit Requests</h2>
            <p className="mt-1 text-xs text-gray-400">
              Review and process submitted deposit requests.
            </p>
          </div>

          <div className={cardClass}>
            <label className={labelClass}>Deposit Status</label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">All Deposits</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <button
              type="button"
              onClick={() => fetchDeposits(1)}
              disabled={loadingDeposits}
              className="mt-3 w-full rounded-lg bg-[#218653] px-4 py-3 font-semibold disabled:opacity-50"
            >
              {loadingDeposits ? "Loading..." : "Filter Deposits"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={cardClass}>
              <p className="text-xs text-gray-400">Total Records</p>
              <p className="mt-2 text-2xl font-bold">
                {pagination.total}
              </p>
            </div>

            <div className={cardClass}>
              <p className="text-xs text-gray-400">Current Page</p>
              <p className="mt-2 text-2xl font-bold">{page}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#244632] bg-[#10251a]">
            <div className="flex items-center justify-between border-b border-[#244632] p-4">
              <h3 className="font-semibold">Deposit History</h3>
              <span className="text-xs text-gray-400">
                {pagination.total} records
              </span>
            </div>

            {loadingDeposits ? (
              <p className="p-5 text-center text-sm text-gray-400">
                Loading deposit requests...
              </p>
            ) : deposits.length === 0 ? (
              <p className="p-5 text-center text-sm text-gray-400">
                No deposit requests found.
              </p>
            ) : (
              <div className="divide-y divide-[#244632]">
                {deposits.map((deposit) => (
                  <div key={deposit.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-all font-semibold text-green-300">
                          {deposit.deposit_tracking_id || "No Tracking ID"}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {deposit.payment_method_name ||
                            deposit.payment_method_code ||
                            "Payment Method"}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${statusClass(
                          deposit.status
                        )}`}
                      >
                        {(deposit.status || "unknown").toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-gray-500">Amount</p>
                        <p className="mt-1 text-lg font-bold">
                          {formatAmount(deposit.amount)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] text-gray-500">Created</p>
                        <p className="mt-1 text-xs text-gray-300">
                          {formatDate(deposit.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1 rounded-lg bg-[#09170f] p-3">
                      <p className="break-all text-xs text-gray-400">
                        User ID: {deposit.user_id}
                      </p>
                      <p className="break-all text-xs text-gray-400">
                        Transaction ID: {deposit.transaction_id || "—"}
                      </p>
                      <p className="break-all text-xs text-gray-400">
                        Sender Account: {deposit.sender_account || "—"}
                      </p>
                    </div>

                    {deposit.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDeposit(deposit);
                          setAdminNote("");
                          setRejectionReason("");
                          setError("");
                        }}
                        className="w-full rounded-lg border border-[#315d45] px-4 py-3 text-sm font-semibold text-green-300"
                      >
                        Review Deposit
                      </button>
                    )}

                    {deposit.status !== "pending" && (
                      <div className="rounded-lg border border-[#244632] p-3 text-xs text-gray-400">
                        Reviewed At: {formatDate(deposit.reviewed_at)}
                        {deposit.admin_note && (
                          <p className="mt-2 break-words">
                            Admin Note: {deposit.admin_note}
                          </p>
                        )}
                        {deposit.rejection_reason && (
                          <p className="mt-2 break-words text-red-300">
                            Rejection Reason: {deposit.rejection_reason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={page <= 1 || loadingDeposits}
              onClick={() => fetchDeposits(page - 1)}
              className="rounded-lg border border-[#315d45] px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>

            <p className="text-xs text-gray-400">
              Page {pagination.page} of {pagination.total_pages || 1}
            </p>

            <button
              type="button"
              disabled={
                page >= pagination.total_pages || loadingDeposits
              }
              onClick={() => fetchDeposits(page + 1)}
              className="rounded-lg border border-[#315d45] px-4 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* DEPOSIT REVIEW MODAL */}

      {selectedDeposit && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/75 p-4">
          <div className="mx-auto my-6 max-w-xl rounded-2xl border border-[#315d45] bg-[#10251a]">
            <div className="flex items-center justify-between border-b border-[#315d45] p-4">
              <h2 className="font-bold text-green-400">
                REVIEW DEPOSIT
              </h2>

              <button
                type="button"
                onClick={() => {
                  setSelectedDeposit(null);
                  setAdminNote("");
                  setRejectionReason("");
                }}
                className="rounded-lg bg-[#193b29] px-3 py-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 p-4">
              {[
                ["Tracking ID", selectedDeposit.deposit_tracking_id],
                ["User ID", selectedDeposit.user_id],
                ["Payment Method", selectedDeposit.payment_method_name],
                ["Amount", formatAmount(selectedDeposit.amount)],
                ["Transaction ID", selectedDeposit.transaction_id],
                ["Sender Account", selectedDeposit.sender_account],
                ["Submitted At", formatDate(selectedDeposit.created_at)],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex items-start justify-between gap-4 border-b border-[#244632] pb-2"
                >
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="max-w-[60%] break-all text-right text-sm">
                    {value || "—"}
                  </span>
                </div>
              ))}

              <div className="space-y-2 border-t border-[#315d45] pt-4">
                <label className={labelClass}>
                  Admin Note (Optional)
                </label>

                <textarea
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Internal approval note"
                  className={inputClass}
                />

                <button
                  type="button"
                  onClick={handleApproveDeposit}
                  disabled={processingDeposit !== ""}
                  className="w-full rounded-lg bg-green-700 px-4 py-3 font-bold text-white disabled:opacity-50"
                >
                  {processingDeposit === selectedDeposit.id
                    ? "Processing..."
                    : "APPROVE DEPOSIT"}
                </button>
              </div>

              <div className="space-y-2 border-t border-[#315d45] pt-4">
                <label className={labelClass}>
                  Rejection Reason (Required)
                </label>

                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this deposit is rejected"
                  maxLength={500}
                  className={inputClass}
                />

                <button
                  type="button"
                  onClick={handleRejectDeposit}
                  disabled={
                    processingDeposit !== "" ||
                    !rejectionReason.trim()
                  }
                  className="w-full rounded-lg bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-50"
                >
                  {processingDeposit === selectedDeposit.id
                    ? "Processing..."
                    : "REJECT DEPOSIT"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
