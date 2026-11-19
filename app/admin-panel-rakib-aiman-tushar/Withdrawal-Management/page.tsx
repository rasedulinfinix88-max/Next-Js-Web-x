
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

const supabase = createClient();

const ADMIN_PATH = "/admin-panel-rakib-aiman-tushar";

type Section = "overview" | "withdrawals" | "methods" | "settings";
type WithdrawalStatus = "pending" | "approved" | "rejected";

type Withdrawal = {
  id: string;
  tracking_id: string;
  user_id: string;
  amount: number;
  status: WithdrawalStatus;
  payment_method_code: string;
  payment_method_name: string;
  admin_note?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  profiles?: {
    full_name?: string;
    user_mobile?: string;
    lottery_id?: string;
  } | null;
  withdrawal_account_snapshots?: Array<{
    payment_method_code?: string;
    account_snapshot?: Record<string, any>;
  }>;
};

type WithdrawalMethod = {
  id: string;
  method_code: string;
  method_name: string;
  method_type?: string;
  is_enabled: boolean;
  min_withdrawal: number;
  max_withdrawal: number;
  withdrawal_instructions?: string | null;
  maintenance_message?: string | null;
};

const inputClass =
  "w-full rounded-xl border border-[#315d45] bg-[#09170f] px-3 py-3 text-sm text-white outline-none focus:border-green-500";

const labelClass = "mb-2 block text-sm text-gray-300";

const cardClass =
  "rounded-2xl border border-[#244632] bg-[#10251a] p-4";

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAmount(value: any) {
  return Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getSnapshot(item: Withdrawal) {
  const relation = item.withdrawal_account_snapshots;

  if (Array.isArray(relation)) {
    return relation[0]?.account_snapshot || {};
  }

  return {};
}

function getProfile(item: Withdrawal) {
  return item.profiles || {};
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    approved: "border-green-500/30 bg-green-500/10 text-green-300",
    rejected: "border-red-500/30 bg-red-500/10 text-red-300",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[status] || "border-gray-600 bg-gray-700/20 text-gray-300"
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}

export default function WithdrawalManagementPage() {
  const router = useRouter();

  const [section, setSection] = useState<Section>("overview");
  const [adminRole, setAdminRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<Withdrawal | null>(null);

  const [decision, setDecision] = useState<"approved" | "rejected">(
    "approved"
  );
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [savingMethodId, setSavingMethodId] = useState("");
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isSuperAdmin = adminRole === "super_admin";

  const invokeManager = useCallback(async (body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke(
      "withdrawal-manager",
      { body }
    );

    if (error) {
      throw new Error(error.message || "Withdrawal Manager request failed");
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }, []);

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setErrorMessage("");

      try {
        const access = await checkAdminAccess();

        const role = access?.role || "";

        if (!["admin", "super_admin"].includes(role)) {
          setAccessDenied(true);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        setAdminRole(role);

        const [methodData, withdrawalData] = await Promise.all([
          invokeManager({ action: "get_methods" }),
          invokeManager({
            action: "admin_list",
            status: statusFilter === "all" ? "" : statusFilter,
          }),
        ]);

        setMethods(methodData?.methods || []);
        setSettings(methodData?.settings || null);
        setGlobalEnabled(
          methodData?.settings?.is_withdrawal_enabled === true
        );
        setMaintenanceMessage(
          methodData?.settings?.maintenance_message || ""
        );

        setWithdrawals(withdrawalData?.withdrawals || []);
      } catch (error: any) {
        setErrorMessage(error?.message || "Unable to load withdrawal data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [invokeManager, statusFilter]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, search]);

  const filteredWithdrawals = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return withdrawals;

    return withdrawals.filter((item) => {
      const profile = getProfile(item);

      return [
        item.tracking_id,
        item.payment_method_name,
        item.payment_method_code,
        item.status,
        profile.full_name,
        profile.user_mobile,
        profile.lottery_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [withdrawals, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredWithdrawals.length / pageSize)
  );

  const paginatedWithdrawals = filteredWithdrawals.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const pendingCount = withdrawals.filter(
    (item) => item.status === "pending"
  ).length;

  const approvedCount = withdrawals.filter(
    (item) => item.status === "approved"
  ).length;

  const rejectedCount = withdrawals.filter(
    (item) => item.status === "rejected"
  ).length;

  const pendingAmount = withdrawals
    .filter((item) => item.status === "pending")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  function showSuccess(message: string) {
    setNotice(message);
    setErrorMessage("");

    window.setTimeout(() => setNotice(""), 4000);
  }

  function openReview(item: Withdrawal, nextDecision: "approved" | "rejected") {
    setSelectedWithdrawal(item);
    setDecision(nextDecision);
    setAdminNote(item.admin_note || "");
    setRejectionReason(item.rejection_reason || "");
  }

  async function submitReview() {
    if (!selectedWithdrawal) return;

    if (
      decision === "rejected" &&
      !rejectionReason.trim()
    ) {
      setErrorMessage("Rejection reason is required.");
      return;
    }

    setReviewing(true);
    setErrorMessage("");

    try {
      await invokeManager({
        action: "review_request",
        withdrawal_id: selectedWithdrawal.id,
        decision,
        admin_note: adminNote.trim(),
        rejection_reason:
          decision === "rejected" ? rejectionReason.trim() : "",
      });

      setSelectedWithdrawal(null);
      setAdminNote("");
      setRejectionReason("");

      showSuccess(
        decision === "approved"
          ? "Withdrawal request approved successfully."
          : "Withdrawal request rejected and refund processed."
      );

      await loadData(true);
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to review request");
    } finally {
      setReviewing(false);
    }
  }

  async function saveGlobalSettings() {
    if (!isSuperAdmin) return;

    setSavingSettings(true);
    setErrorMessage("");

    try {
      const result = await invokeManager({
        action: "update_global_settings",
        is_withdrawal_enabled: globalEnabled,
        maintenance_message: maintenanceMessage.trim(),
      });

      setSettings(result?.settings || settings);

      showSuccess("Global withdrawal settings updated.");
      await loadData(true);
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to update settings");
    } finally {
      setSavingSettings(false);
    }
  }

  function updateMethodField(
    methodId: string,
    field: string,
    value: any
  ) {
    setMethods((current) =>
      current.map((method) =>
        method.id === methodId
          ? { ...method, [field]: value }
          : method
      )
    );
  }

  async function saveMethod(method: WithdrawalMethod) {
    if (!isSuperAdmin) return;

    setSavingMethodId(method.id);
    setErrorMessage("");

    try {
      const result = await invokeManager({
        action: "update_method",
        method_id: method.id,
        is_enabled: method.is_enabled,
        min_withdrawal: Number(method.min_withdrawal),
        max_withdrawal: Number(method.max_withdrawal),
        withdrawal_instructions: method.withdrawal_instructions || "",
        maintenance_message: method.maintenance_message || "",
      });

      if (result?.method) {
        setMethods((current) =>
          current.map((item) =>
            item.id === method.id ? result.method : item
          )
        );
      }

      showSuccess(`${method.method_name} settings saved.`);
      await loadData(true);
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to update payment method");
    } finally {
      setSavingMethodId("");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push(`${ADMIN_PATH}/login`);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07130c] text-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-green-900 border-t-green-400" />
          <p className="text-sm text-gray-300">
            Loading Withdrawal Management...
          </p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07130c] px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-900 bg-[#10251a] p-6 text-center">
          <h1 className="mb-2 text-xl font-bold text-red-400">
            Access Denied
          </h1>
          <p className="mb-5 text-sm text-gray-300">
            Admin or Super Admin access is required.
          </p>
          <button
            onClick={() => router.push(ADMIN_PATH)}
            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold"
          >
            Back to Admin Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07130c] text-white">
      <AdminMenu />

      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Withdrawal Management
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Manage withdrawal requests, payment methods and settings.
            </p>
            <span className="mt-2 inline-flex rounded-full border border-green-700/50 bg-green-900/30 px-3 py-1 text-xs font-semibold text-green-300">
              {adminRole.replace("_", " ").toUpperCase()}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="rounded-xl border border-[#315d45] bg-[#10251a] px-4 py-2.5 text-sm font-semibold text-green-300 disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-2.5 text-sm font-semibold text-red-300"
            >
              Logout
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-4 rounded-xl border border-green-700 bg-green-950/50 p-3 text-sm text-green-300">
            {notice}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { id: "overview", label: "Overview" },
            { id: "withdrawals", label: "Withdrawal List" },
            { id: "methods", label: "Payment Methods" },
            { id: "settings", label: "Settings" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id as Section)}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                section === item.id
                  ? "border-green-500 bg-green-800 text-white"
                  : "border-[#244632] bg-[#10251a] text-gray-300 hover:border-green-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {section === "overview" && (
          <div>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className={cardClass}>
                <p className="text-xs text-gray-400">Pending Requests</p>
                <p className="mt-2 text-2xl font-bold text-yellow-300">
                  {pendingCount}
                </p>
              </div>

              <div className={cardClass}>
                <p className="text-xs text-gray-400">Approved Requests</p>
                <p className="mt-2 text-2xl font-bold text-green-300">
                  {approvedCount}
                </p>
              </div>

              <div className={cardClass}>
                <p className="text-xs text-gray-400">Rejected Requests</p>
                <p className="mt-2 text-2xl font-bold text-red-300">
                  {rejectedCount}
                </p>
              </div>

              <div className={cardClass}>
                <p className="text-xs text-gray-400">Pending Amount</p>
                <p className="mt-2 break-words text-xl font-bold text-white">
                  ৳ {formatAmount(pendingAmount)}
                </p>
              </div>
            </div>

            <div className={`${cardClass} mb-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">Global Withdrawal Status</h2>
                  <p className="mt-1 text-xs text-gray-400">
                    Current withdrawal availability
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    globalEnabled
                      ? "border-green-600 bg-green-900/30 text-green-300"
                      : "border-red-700 bg-red-950/30 text-red-300"
                  }`}
                >
                  {globalEnabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>

              {settings?.maintenance_message && (
                <p className="mt-3 rounded-xl bg-[#09170f] p-3 text-sm text-gray-300">
                  {settings.maintenance_message}
                </p>
              )}
            </div>

            <div className={cardClass}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Recent Withdrawal Requests</h2>
                <button
                  onClick={() => setSection("withdrawals")}
                  className="text-xs font-semibold text-green-400"
                >
                  View All
                </button>
              </div>

              {withdrawals.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  No withdrawal requests found.
                </p>
              ) : (
                <div className="space-y-3">
                  {withdrawals.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#244632] bg-[#09170f] p-3"
                    >
                      <div className="min-w-0">
                        <p className="break-all text-sm font-semibold">
                          {item.tracking_id}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {item.payment_method_name} · {formatDate(item.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold">
                          ৳ {formatAmount(item.amount)}
                        </p>
                        <StatusBadge status={item.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {section === "withdrawals" && (
          <div className={cardClass}>
            <div className="mb-4">
              <h2 className="text-lg font-bold">Withdrawal Requests</h2>
              <p className="mt-1 text-xs text-gray-400">
                View, search, approve or reject withdrawal requests.
              </p>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Search Requests</label>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tracking ID, name, mobile or Lottery ID"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Filter by Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className={inputClass}
                >
                  <option value="all">All Requests</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="mb-3 text-xs text-gray-400">
              Showing {filteredWithdrawals.length} request(s)
            </div>

            {paginatedWithdrawals.length === 0 ? (
              <div className="rounded-xl border border-[#244632] bg-[#09170f] py-10 text-center text-sm text-gray-400">
                No withdrawal requests found.
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedWithdrawals.map((item) => {
                  const profile = getProfile(item);
                  const snapshot = getSnapshot(item);

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#315d45] bg-[#09170f] p-3 sm:p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-all text-sm font-bold text-green-300">
                            {item.tracking_id}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {formatDate(item.created_at)}
                          </p>
                        </div>

                        <StatusBadge status={item.status} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">User Name</p>
                          <p className="mt-1 break-words font-semibold">
                            {profile.full_name || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Mobile</p>
                          <p className="mt-1 break-all font-semibold">
                            {profile.user_mobile || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Lottery ID</p>
                          <p className="mt-1 font-semibold">
                            {profile.lottery_id || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Payment Method</p>
                          <p className="mt-1 font-semibold">
                            {item.payment_method_name || item.payment_method_code}
                          </p>
                        </div>

                        <div className="col-span-2 rounded-lg bg-[#10251a] p-3">
                          <p className="text-xs text-gray-400">Withdrawal Amount</p>
                          <p className="mt-1 text-xl font-bold text-green-300">
                            ৳ {formatAmount(item.amount)}
                          </p>
                        </div>
                      </div>

                      {Object.keys(snapshot).length > 0 && (
                        <details className="mt-3 rounded-lg border border-[#244632] bg-[#10251a] p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-green-300">
                            Withdrawal Account Details
                          </summary>

                          <div className="mt-3 space-y-2">
                            {Object.entries(snapshot).map(([key, value]) => (
                              <div
                                key={key}
                                className="flex flex-wrap justify-between gap-2 border-b border-[#244632] pb-2 text-xs last:border-0"
                              >
                                <span className="text-gray-400">
                                  {key.replace(/_/g, " ")}
                                </span>
                                <span className="max-w-[65%] break-all text-right text-white">
                                  {typeof value === "object"
                                    ? JSON.stringify(value)
                                    : String(value ?? "—")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {item.admin_note && (
                        <p className="mt-3 rounded-lg bg-[#10251a] p-3 text-xs text-gray-300">
                          Admin Note: {item.admin_note}
                        </p>
                      )}

                      {item.rejection_reason && (
                        <p className="mt-2 rounded-lg bg-red-950/30 p-3 text-xs text-red-300">
                          Rejection Reason: {item.rejection_reason}
                        </p>
                      )}

                      {item.status === "pending" && (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => openReview(item, "approved")}
                            className="rounded-xl bg-green-700 px-3 py-3 text-sm font-bold text-white hover:bg-green-600"
                          >
                            Approve
                          </button>

                          <button
                            onClick={() => openReview(item, "rejected")}
                            className="rounded-xl border border-red-700 bg-red-950/40 px-3 py-3 text-sm font-bold text-red-300 hover:bg-red-950"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {item.reviewed_at && (
                        <p className="mt-3 text-xs text-gray-500">
                          Reviewed: {formatDate(item.reviewed_at)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                  className="rounded-lg border border-[#315d45] px-4 py-2 text-sm disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-xs text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  className="rounded-lg border border-[#315d45] px-4 py-2 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {section === "methods" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Withdrawal Payment Methods</h2>
              <p className="mt-1 text-xs text-gray-400">
                Configure supported withdrawal methods.
              </p>
            </div>

            {methods.length === 0 ? (
              <div className={cardClass}>
                <p className="text-center text-sm text-gray-400">
                  No payment methods found.
                </p>
              </div>
            ) : (
              methods.map((method) => (
                <div key={method.id} className={cardClass}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">
                        {method.method_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {method.method_code.toUpperCase()}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        method.is_enabled
                          ? "bg-green-900/40 text-green-300"
                          : "bg-red-950/40 text-red-300"
                      }`}
                    >
                      {method.is_enabled ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>

                  {isSuperAdmin ? (
                    <>
                      <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl bg-[#09170f] p-3">
                        <input
                          type="checkbox"
                          checked={method.is_enabled === true}
                          onChange={(event) =>
                            updateMethodField(
                              method.id,
                              "is_enabled",
                              event.target.checked
                            )
                          }
                          className="h-5 w-5 accent-green-500"
                        />
                        <span className="text-sm font-semibold">
                          Enable this payment method
                        </span>
                      </label>

                      <div className="mb-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>
                            Minimum Withdrawal
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={method.min_withdrawal ?? 0}
                            onChange={(event) =>
                              updateMethodField(
                                method.id,
                                "min_withdrawal",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Maximum Withdrawal
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={method.max_withdrawal ?? 0}
                            onChange={(event) =>
                              updateMethodField(
                                method.id,
                                "max_withdrawal",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className={labelClass}>
                          Withdrawal Instructions
                        </label>
                        <textarea
                          rows={3}
                          value={method.withdrawal_instructions || ""}
                          onChange={(event) =>
                            updateMethodField(
                              method.id,
                              "withdrawal_instructions",
                              event.target.value
                            )
                          }
                          className={inputClass}
                          placeholder="Instructions shown to users"
                        />
                      </div>

                      <div className="mb-4">
                        <label className={labelClass}>
                          Method Maintenance Message
                        </label>
                        <textarea
                          rows={2}
                          value={method.maintenance_message || ""}
                          onChange={(event) =>
                            updateMethodField(
                              method.id,
                              "maintenance_message",
                              event.target.value
                            )
                          }
                          className={inputClass}
                          placeholder="Optional maintenance message"
                        />
                      </div>

                      <button
                        onClick={() => saveMethod(method)}
                        disabled={savingMethodId === method.id}
                        className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {savingMethodId === method.id
                          ? "Saving..."
                          : "Save Method Settings"}
                      </button>
                    </>
                  ) : (
                    <div className="rounded-xl bg-[#09170f] p-3 text-sm text-gray-300">
                      <p>
                        Minimum: ৳ {formatAmount(method.min_withdrawal)}
                      </p>
                      <p className="mt-1">
                        Maximum: ৳ {formatAmount(method.max_withdrawal)}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        Only Super Admin can change payment method settings.
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {section === "settings" && (
          <div className={cardClass}>
            <h2 className="text-lg font-bold">Global Withdrawal Settings</h2>
            <p className="mt-1 text-xs text-gray-400">
              Control whether users can submit withdrawal requests.
            </p>

            {!isSuperAdmin ? (
              <div className="mt-4 rounded-xl border border-yellow-700/40 bg-yellow-950/20 p-4 text-sm text-yellow-200">
                You can view withdrawal settings, but only Super Admin can
                change them.
                <p className="mt-3 text-white">
                  Current Status:{" "}
                  <strong>
                    {globalEnabled ? "ENABLED" : "DISABLED"}
                  </strong>
                </p>
                <p className="mt-2 text-gray-300">
                  Maintenance Message: {maintenanceMessage || "None"}
                </p>
              </div>
            ) : (
              <>
                <label className="mt-5 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#315d45] bg-[#09170f] p-4">
                  <div>
                    <p className="font-semibold">Global Withdrawal</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Turn withdrawal requests ON or OFF for all users.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={globalEnabled}
                    onChange={(event) =>
                      setGlobalEnabled(event.target.checked)
                    }
                    className="h-6 w-6 accent-green-500"
                  />
                </label>

                <div className="mt-4">
                  <label className={labelClass}>
                    Global Maintenance Message
                  </label>
                  <textarea
                    rows={4}
                    value={maintenanceMessage}
                    onChange={(event) =>
                      setMaintenanceMessage(event.target.value)
                    }
                    className={inputClass}
                    placeholder="Example: Withdrawal is temporarily unavailable. Please try again later."
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    This message is shown to users when global withdrawal is
                    disabled.
                  </p>
                </div>

                <div className="mt-5 rounded-xl border border-[#315d45] bg-[#09170f] p-3">
                  <p className="text-sm font-semibold">Current Status</p>
                  <p
                    className={`mt-2 text-sm font-bold ${
                      globalEnabled ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {globalEnabled ? "WITHDRAWAL ENABLED" : "WITHDRAWAL DISABLED"}
                  </p>
                </div>

                <button
                  onClick={saveGlobalSettings}
                  disabled={savingSettings}
                  className="mt-5 w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {savingSettings ? "Saving..." : "Save Global Settings"}
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {selectedWithdrawal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-3">
          <div className="my-auto w-full max-w-lg rounded-2xl border border-[#315d45] bg-[#10251a] p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">
                {decision === "approved"
                  ? "Approve Withdrawal"
                  : "Reject Withdrawal"}
              </h2>

              <button
                onClick={() => setSelectedWithdrawal(null)}
                className="rounded-lg px-3 py-1 text-xl text-gray-400 hover:bg-[#09170f]"
              >
                ×
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-[#09170f] p-3 text-sm">
              <p className="break-all text-green-300">
                {selectedWithdrawal.tracking_id}
              </p>
              <p className="mt-2 text-gray-400">
                User: {getProfile(selectedWithdrawal).full_name || "—"}
              </p>
              <p className="mt-1 text-gray-400">
                Method: {selectedWithdrawal.payment_method_name}
              </p>
              <p className="mt-2 text-lg font-bold text-white">
                ৳ {formatAmount(selectedWithdrawal.amount)}
              </p>
            </div>

            <div className="mb-4">
              <label className={labelClass}>Decision</label>
              <select
                value={decision}
                onChange={(event) =>
                  setDecision(event.target.value as "approved" | "rejected")
                }
                className={inputClass}
              >
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </div>

            <div className="mb-4">
              <label className={labelClass}>Admin Note (Optional)</label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                className={inputClass}
                placeholder="Write an internal admin note"
              />
            </div>

            {decision === "rejected" && (
              <div className="mb-4">
                <label className={labelClass}>
                  Rejection Reason (Required)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(event) =>
                    setRejectionReason(event.target.value)
                  }
                  className={inputClass}
                  placeholder="Explain why this request is being rejected"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedWithdrawal(null)}
                disabled={reviewing}
                className="rounded-xl border border-[#315d45] px-3 py-3 text-sm font-semibold text-gray-300"
              >
                Cancel
              </button>

              <button
                onClick={submitReview}
                disabled={
                  reviewing ||
                  (decision === "rejected" && !rejectionReason.trim())
                }
                className={`rounded-xl px-3 py-3 text-sm font-bold text-white disabled:opacity-50 ${
                  decision === "approved"
                    ? "bg-green-700"
                    : "bg-red-700"
                }`}
              >
                {reviewing
                  ? "Processing..."
                  : decision === "approved"
                    ? "Confirm Approve"
                    : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
