
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

type FeeSetting = {
  id: string;
  fee_code: string;
  fee_name: string;
  percentage: number;
  is_enabled: boolean;
  updated_at?: string;
};

type PaymentRecord = {
  id: string;
  assessment_id: string;
  user_id: string;
  payment_method_code: string;
  sender_account: string;
  transaction_id: string;
  submitted_amount: number;
  status: string;
  admin_note: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type AssessmentRecord = {
  id: string;
  winning_amount: number;
  total_fee_amount: number;
  total_fee_percentage: number;
  payment_status: string;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  game_id: string | null;
};

type FeePaymentReview = {
  payment: PaymentRecord;
  assessment: AssessmentRecord | null;
  profile: ProfileRecord | null;
};

const FEE_ORDER = [
  "ticket_management_cost",
  "network_fee",
  "management_fee",
  "team_cost",
  "field_cost",
  "service_fee",
];

const FEE_LABELS: Record<string, string> = {
  ticket_management_cost: "TICKET MANAGEMENT COST",
  network_fee: "NETWORK FEE",
  management_fee: "MANAGEMENT FEE",
  team_cost: "TEAM COST",
  field_cost: "FIELD COST",
  service_fee: "SERVICE FEE",
};

function formatAmount(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function UserFeeManagementPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [fees, setFees] = useState<FeeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fee Payment Review States
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewPayments, setReviewPayments] = useState<FeePaymentReview[]>([]);
  const [selectedPayment, setSelectedPayment] =
    useState<FeePaymentReview | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  const loadReviewPayments = useCallback(async () => {
    setReviewLoading(true);
    setReviewError("");

    try {
      const { data: paymentData, error: paymentError } = await supabase
        .from("lottery_fee_payments")
        .select(
          "id, assessment_id, user_id, payment_method_code, sender_account, transaction_id, submitted_amount, status, admin_note, rejection_reason, created_at"
        )
        .in("status", ["pending", "under_review"])
        .order("created_at", { ascending: false });

      if (paymentError) throw paymentError;

      const payments = (paymentData || []) as PaymentRecord[];

      if (payments.length === 0) {
        setReviewPayments([]);
        setSelectedPayment(null);
        return;
      }

      const assessmentIds = [
        ...new Set(payments.map((item) => item.assessment_id)),
      ];

      const userIds = [
        ...new Set(payments.map((item) => item.user_id)),
      ];

      const [
        { data: assessmentData, error: assessmentError },
        { data: profileData, error: profileError },
      ] = await Promise.all([
        supabase
          .from("lottery_fee_assessments")
          .select(
            "id, winning_amount, total_fee_amount, total_fee_percentage, payment_status"
          )
          .in("id", assessmentIds),

        supabase
          .from("profiles")
          .select("id, full_name, game_id")
          .in("id", userIds),
      ]);

      if (assessmentError) throw assessmentError;
      if (profileError) throw profileError;

      const assessments = (assessmentData || []) as AssessmentRecord[];
      const profiles = (profileData || []) as ProfileRecord[];

      const assessmentMap = new Map(
        assessments.map((item) => [item.id, item])
      );

      const profileMap = new Map(
        profiles.map((item) => [item.id, item])
      );

      const combined: FeePaymentReview[] = payments.map((payment) => ({
        payment,
        assessment: assessmentMap.get(payment.assessment_id) || null,
        profile: profileMap.get(payment.user_id) || null,
      }));

      setReviewPayments(combined);

      setSelectedPayment((current) => {
        if (!current) return null;

        return (
          combined.find(
            (item) => item.payment.id === current.payment.id
          ) || null
        );
      });
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error
          ? err.message
          : "Unable to load fee payment requests."
      );
    } finally {
      setReviewLoading(false);
    }
  }, [supabase]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const access = await checkAdminAccess();

      if (!access.allowed || access.role !== "super_admin") {
        router.replace("/");
        return;
      }

      const { data, error: feeError } = await supabase
        .from("lottery_fee_settings")
        .select(
          "id, fee_code, fee_name, percentage, is_enabled, updated_at"
        );

      if (feeError) throw feeError;

      const orderedFees = [...(data || [])]
        .sort((a, b) => {
          const aIndex = FEE_ORDER.indexOf(a.fee_code);
          const bIndex = FEE_ORDER.indexOf(b.fee_code);

          return (
            (aIndex === -1 ? 999 : aIndex) -
            (bIndex === -1 ? 999 : bIndex)
          );
        })
        .map((fee) => ({
          ...fee,
          percentage: Number(fee.percentage),
        }));

      setFees(orderedFees);

      await loadReviewPayments();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load fee settings."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase, loadReviewPayments]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const updateFee = (
    feeCode: string,
    changes: Partial<FeeSetting>
  ) => {
    setFees((current) =>
      current.map((fee) =>
        fee.fee_code === feeCode
          ? { ...fee, ...changes }
          : fee
      )
    );

    setError("");
    setSuccess("");
  };

  const saveFee = async (fee: FeeSetting) => {
    setError("");
    setSuccess("");

    if (
      !Number.isFinite(fee.percentage) ||
      fee.percentage < 0 ||
      fee.percentage > 100
    ) {
      setError("Percentage must be between 0 and 100.");
      return;
    }

    setSavingCode(fee.fee_code);

    try {
      const access = await checkAdminAccess();

      if (!access.allowed || access.role !== "super_admin") {
        router.replace("/");
        return;
      }

      const { data, error: rpcError } = await supabase.rpc(
        "admin_set_lottery_fee",
        {
          p_fee_code: fee.fee_code,
          p_percentage: fee.percentage,
          p_is_enabled: fee.is_enabled,
        }
      );

      if (rpcError) throw rpcError;

      if (!data) {
        throw new Error("Fee settings were not returned.");
      }

      const saved = Array.isArray(data) ? data[0] : data;

      setFees((current) =>
        current.map((item) =>
          item.fee_code === fee.fee_code
            ? {
                ...item,
                percentage: Number(saved.percentage),
                is_enabled: saved.is_enabled,
                updated_at: saved.updated_at,
              }
            : item
        )
      );

      setSuccess(`${fee.fee_name} saved successfully.`);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save fee settings."
      );
    } finally {
      setSavingCode(null);
    }
  };

  const openReviewModal = async () => {
    setReviewOpen(true);
    setSelectedPayment(null);
    setReviewError("");
    setReviewSuccess("");
    setAdminNote("");
    setRejectionReason("");

    await loadReviewPayments();
  };

  const selectPayment = (item: FeePaymentReview) => {
    setSelectedPayment(item);
    setAdminNote(item.payment.admin_note || "");
    setRejectionReason(item.payment.rejection_reason || "");
    setReviewError("");
    setReviewSuccess("");
  };

  const reviewPayment = async (
    decision: "approved" | "rejected"
  ) => {
    if (!selectedPayment) return;

    if (
      decision === "rejected" &&
      !rejectionReason.trim()
    ) {
      setReviewError("Please enter a rejection reason.");
      return;
    }

    setReviewing(true);
    setReviewError("");
    setReviewSuccess("");

    try {
      const access = await checkAdminAccess();

      if (!access.allowed || access.role !== "super_admin") {
        router.replace("/");
        return;
      }

      const { data, error: rpcError } = await supabase.rpc(
        "admin_review_lottery_fee_payment",
        {
          p_payment_id: selectedPayment.payment.id,
          p_decision: decision,
          p_admin_note: adminNote.trim() || null,
          p_rejection_reason:
            decision === "rejected"
              ? rejectionReason.trim()
              : null,
        }
      );

      if (rpcError) throw rpcError;

      if (!data) {
        throw new Error("Payment review result was not returned.");
      }

      setReviewSuccess(
        decision === "approved"
          ? "Fee payment approved successfully."
          : "Fee payment rejected successfully."
      );

      setSelectedPayment(null);
      setAdminNote("");
      setRejectionReason("");

      await loadReviewPayments();
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error
          ? err.message
          : "Unable to review this payment."
      );
    } finally {
      setReviewing(false);
    }
  };

  const totalEnabledPercentage = fees
    .filter((fee) => fee.is_enabled)
    .reduce(
      (total, fee) => total + Number(fee.percentage),
      0
    );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07110d] text-white flex items-center justify-center">
        Loading Fee Management...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07110d] text-white">
      <AdminMenu />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-sm text-emerald-400 font-semibold mb-2">
            SUPER ADMIN PANEL
          </p>

          <h1 className="text-2xl md:text-3xl font-bold">
            User Fee Management
          </h1>

          <p className="text-sm text-gray-400 mt-2">
            Manage all six lottery fee categories.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-700 bg-red-950/50 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-700 bg-emerald-950/50 p-4 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Fee Payment Review Button */}
        <div className="rounded-2xl border border-emerald-700/60 bg-[#10251b] p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                Fee Payment Review
              </h2>

              <p className="text-xs text-gray-400 mt-1">
                Review and approve or reject user fee payments.
              </p>

              <p className="text-sm text-emerald-400 mt-2 font-semibold">
                {reviewPayments.length} Pending / Under Review
              </p>
            </div>

            <button
              type="button"
              onClick={openReviewModal}
              className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 font-bold text-white transition"
            >
              Review Fee Payments
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#24513a] bg-[#10251b] p-4 mb-6">
          <p className="text-sm text-gray-400">
            Total Enabled Fee Percentage
          </p>

          <div className="text-3xl font-bold text-emerald-400 mt-2">
            {totalEnabledPercentage.toFixed(2)}%
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Only enabled fee categories are included.
          </p>
        </div>

        <div className="space-y-4">
          {fees.map((fee) => (
            <div
              key={fee.fee_code}
              className="rounded-2xl border border-[#254c38] bg-[#10251b] p-4 md:p-5"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-white text-sm md:text-base">
                    {FEE_LABELS[fee.fee_code] || fee.fee_name}
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    {fee.fee_code}
                  </p>
                </div>

                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    fee.is_enabled
                      ? "bg-emerald-900 text-emerald-300"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {fee.is_enabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Fee Percentage (%)
                </label>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={fee.percentage}
                    onChange={(e) =>
                      updateFee(fee.fee_code, {
                        percentage:
                          e.target.value === ""
                            ? 0
                            : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-[#315b43] bg-[#071810] px-4 py-3 pr-12 text-white outline-none focus:border-emerald-500"
                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">
                    %
                  </span>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl bg-[#091a11] border border-[#254c38] p-3 cursor-pointer">
                <span className="text-sm font-medium">
                  Enable this fee
                </span>

                <input
                  type="checkbox"
                  checked={fee.is_enabled}
                  onChange={(e) =>
                    updateFee(fee.fee_code, {
                      is_enabled: e.target.checked,
                    })
                  }
                  className="h-5 w-5 accent-emerald-500"
                />
              </label>

              <button
                type="button"
                onClick={() => saveFee(fee)}
                disabled={savingCode !== null}
                className="w-full mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 font-bold text-white transition"
              >
                {savingCode === fee.fee_code
                  ? "Saving..."
                  : "Save Fee Settings"}
              </button>
            </div>
          ))}
        </div>

        {fees.length === 0 && (
          <div className="rounded-xl bg-[#10251b] border border-[#254c38] p-5 text-center text-gray-400">
            No fee categories found.
          </div>
        )}

        <div className="mt-6 rounded-xl border border-yellow-800/60 bg-yellow-950/20 p-4">
          <p className="text-sm text-yellow-300 font-semibold">
            Important Notice
          </p>

          <p className="text-xs text-gray-400 mt-2 leading-6">
            Each fee category is saved separately. Changes are recorded
            in the existing fee audit log. A fee assessment uses the
            enabled rates when the assessment is created.
          </p>
        </div>
      </main>

      {/* Fee Payment Review Modal */}
      {reviewOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-3 sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget && !reviewing) {
              setReviewOpen(false);
            }
          }}
        >
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[#315b43] bg-[#0b1b12] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#254c38] bg-[#10251b] p-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Fee Payment Review
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Super Admin Approval Center
                </p>
              </div>

              <button
                type="button"
                disabled={reviewing}
                onClick={() => setReviewOpen(false)}
                className="h-9 w-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xl disabled:opacity-50"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              {reviewError && (
                <div className="rounded-xl border border-red-700 bg-red-950/50 p-3 text-sm text-red-300">
                  {reviewError}
                </div>
              )}

              {reviewSuccess && (
                <div className="rounded-xl border border-emerald-700 bg-emerald-950/50 p-3 text-sm text-emerald-300">
                  {reviewSuccess}
                </div>
              )}

              {reviewLoading && (
                <div className="py-8 text-center text-gray-400">
                  Loading payment requests...
                </div>
              )}

              {!reviewLoading && reviewPayments.length === 0 && (
                <div className="rounded-xl border border-[#254c38] bg-[#10251b] p-7 text-center">
                  <p className="text-emerald-400 font-bold">
                    No Pending Fee Payments
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    There are currently no payments waiting for review.
                  </p>
                </div>
              )}

              {!reviewLoading && reviewPayments.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-300 mb-3">
                    PAYMENT REQUESTS ({reviewPayments.length})
                  </h3>

                  <div className="space-y-2">
                    {reviewPayments.map((item) => (
                      <button
                        type="button"
                        key={item.payment.id}
                        onClick={() => selectPayment(item)}
                        className={`w-full text-left rounded-xl border p-3 transition ${
                          selectedPayment?.payment.id === item.payment.id
                            ? "border-emerald-500 bg-emerald-950/30"
                            : "border-[#254c38] bg-[#10251b] hover:border-emerald-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-white text-sm truncate">
                              {item.profile?.full_name || "Unknown User"}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Lottery ID: {item.profile?.game_id || "N/A"}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full bg-yellow-900/60 px-2.5 py-1 text-[10px] font-bold text-yellow-300">
                            {item.payment.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-3">
                          <span className="text-xs text-gray-400">
                            {item.payment.payment_method_code}
                          </span>

                          <span className="text-sm font-bold text-emerald-400">
                            ৳{formatAmount(item.payment.submitted_amount)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedPayment && (
                <div className="rounded-xl border border-emerald-700/60 bg-[#10251b] p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-white">
                      Payment Details
                    </h3>

                    <span className="text-[10px] font-bold rounded-full bg-yellow-900/60 px-2 py-1 text-yellow-300">
                      {selectedPayment.payment.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">User Name</p>
                      <p className="text-sm text-white font-semibold mt-1">
                        {selectedPayment.profile?.full_name || "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Lottery ID</p>
                      <p className="text-sm text-white font-semibold mt-1">
                        {selectedPayment.profile?.game_id || "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Winning Amount</p>
                      <p className="text-sm text-emerald-400 font-bold mt-1">
                        ৳
                        {formatAmount(
                          selectedPayment.assessment?.winning_amount
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Assessed Fee</p>
                      <p className="text-sm text-emerald-400 font-bold mt-1">
                        ৳
                        {formatAmount(
                          selectedPayment.assessment?.total_fee_amount
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Fee Percentage
                      </p>
                      <p className="text-sm text-white mt-1">
                        {formatAmount(
                          selectedPayment.assessment?.total_fee_percentage
                        )}
                        %
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Submitted Amount
                      </p>
                      <p className="text-sm text-emerald-400 font-bold mt-1">
                        ৳
                        {formatAmount(
                          selectedPayment.payment.submitted_amount
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Payment Method
                      </p>
                      <p className="text-sm text-white mt-1">
                        {selectedPayment.payment.payment_method_code}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Sender Number
                      </p>
                      <p className="text-sm text-white mt-1 break-all">
                        {selectedPayment.payment.sender_account}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500">
                        Transaction ID
                      </p>
                      <p className="text-sm text-white mt-1 break-all">
                        {selectedPayment.payment.transaction_id}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500">
                        Submission Date
                      </p>
                      <p className="text-sm text-white mt-1">
                        {formatDate(selectedPayment.payment.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-[#315b43] pt-4">
                    <label className="block text-xs text-gray-400 mb-2">
                      Admin Note (Optional)
                    </label>

                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={2}
                      disabled={reviewing}
                      placeholder="Write an admin note..."
                      className="w-full rounded-xl border border-[#315b43] bg-[#071810] p-3 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Rejection Reason (Required for Reject)
                    </label>

                    <textarea
                      value={rejectionReason}
                      onChange={(e) =>
                        setRejectionReason(e.target.value)
                      }
                      rows={2}
                      disabled={reviewing}
                      placeholder="Enter reason if rejecting this payment..."
                      className="w-full rounded-xl border border-[#315b43] bg-[#071810] p-3 text-sm text-white outline-none focus:border-red-500 disabled:opacity-50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => reviewPayment("approved")}
                      disabled={reviewing}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3 font-bold text-white transition"
                    >
                      {reviewing ? "Processing..." : "Approve Payment"}
                    </button>

                    <button
                      type="button"
                      onClick={() => reviewPayment("rejected")}
                      disabled={reviewing}
                      className="rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 py-3 font-bold text-white transition"
                    >
                      {reviewing ? "Processing..." : "Reject Payment"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#254c38] p-4">
              <button
                type="button"
                onClick={loadReviewPayments}
                disabled={reviewLoading || reviewing}
                className="w-full rounded-xl border border-[#315b43] bg-[#10251b] hover:bg-[#183a28] disabled:opacity-50 py-3 text-sm font-semibold text-gray-200 transition"
              >
                Refresh Payment Requests
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
