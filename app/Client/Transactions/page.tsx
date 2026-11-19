
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
import { useLanguage } from "../../../lib/LanguageContext";
import LotteryHeader from "../../../components/Header/Header";
import LotteryFooter from "../../../components/Footer/Footer";

type TabType = "deposit" | "withdrawal" | "usdt";

type Transaction = {
  id: string;
  type: "deposit" | "withdrawal";
  tracking_id: string;
  payment_method_code: string;
  payment_method_name: string;
  amount: number | string;
  status: string;
  created_at: string;
  transaction_id?: string | null;
  sender_account?: string | null;
  admin_note?: string | null;
  rejection_reason?: string | null;
};

export default function TransactionsPage() {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabType>("deposit");
  const [depositHistory, setDepositHistory] = useState<Transaction[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositError, setDepositError] = useState("");
  const [withdrawalError, setWithdrawalError] = useState("");

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setDepositError("");
    setWithdrawalError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setDepositError(
          t("Please login to view transactions.", "লেনদেন দেখতে লগইন করুন।")
        );
        setWithdrawalError(
          t("Please login to view transactions.", "লেনদেন দেখতে লগইন করুন।")
        );
        return;
      }

      const userId = authData.user.id;

      const [depositResult, withdrawalResult] = await Promise.all([
        supabase
          .from("deposit_transactions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),

        supabase.functions.invoke("withdrawal-manager", {
          body: { action: "my_history" },
        }),
      ]);

      if (depositResult.error) {
        setDepositError(
          t(
            "Unable to load deposit history.",
            "ডিপোজিট হিস্টোরি লোড করা যায়নি।"
          )
        );
        setDepositHistory([]);
      } else {
        const deposits: Transaction[] = (depositResult.data || []).map(
          (item: any) => ({
            id: item.id,
            type: "deposit",
            tracking_id: item.deposit_tracking_id || "",
            payment_method_code: item.payment_method_code || "",
            payment_method_name: item.payment_method_name || "",
            amount: item.amount,
            status: item.status || "pending",
            created_at: item.created_at,
            transaction_id: item.transaction_id || null,
            sender_account: item.sender_account || null,
            admin_note: item.admin_note || null,
            rejection_reason: item.rejection_reason || null,
          })
        );

        setDepositHistory(deposits);
      }

      if (withdrawalResult.error) {
        setWithdrawalError(
          t(
            "Unable to load withdrawal history.",
            "উইথড্র হিস্টোরি লোড করা যায়নি।"
          )
        );
        setWithdrawalHistory([]);
      } else {
        const history = withdrawalResult.data?.history || [];

        const withdrawals: Transaction[] = history.map((item: any) => ({
          id: item.id,
          type: "withdrawal",
          tracking_id: item.withdrawal_tracking_id || "",
          payment_method_code: item.payment_method_code || "",
          payment_method_name: item.payment_method_name || "",
          amount: item.amount,
          status: item.status || "pending",
          created_at: item.created_at,
          admin_note: item.admin_note || null,
          rejection_reason: item.rejection_reason || null,
        }));

        setWithdrawalHistory(withdrawals);
      }
    } catch {
      setDepositError(
        t(
          "Something went wrong while loading history.",
          "হিস্টোরি লোড করার সময় সমস্যা হয়েছে।"
        )
      );
      setWithdrawalError(
        t(
          "Something went wrong while loading history.",
          "হিস্টোরি লোড করার সময় সমস্যা হয়েছে।"
        )
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const usdtHistory = useMemo(() => {
    return [...depositHistory, ...withdrawalHistory]
      .filter(
        (item) => item.payment_method_code?.toLowerCase() === "usdt"
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
  }, [depositHistory, withdrawalHistory]);

  const currentHistory =
    activeTab === "deposit"
      ? depositHistory
      : activeTab === "withdrawal"
      ? withdrawalHistory
      : usdtHistory;

  const currentError =
    activeTab === "deposit"
      ? depositError
      : activeTab === "withdrawal"
      ? withdrawalError
      : depositError || withdrawalError;

  const formatDate = (date: string) => {
    if (!date) return "—";

    return new Date(date).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-green-500/15 text-green-400 border-green-500/30";
      case "rejected":
        return "bg-red-500/15 text-red-400 border-red-500/30";
      case "pending":
        return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-gray-500/15 text-gray-300 border-gray-500/30";
    }
  };

  const getStatusLabel = (status: string) => {
    const value = status?.toLowerCase();

    if (value === "approved") return t("Approved", "অনুমোদিত");
    if (value === "rejected") return t("Rejected", "বাতিল");
    if (value === "pending") return t("Pending", "অপেক্ষমাণ");

    return status || "—";
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "deposit", label: t("Deposit", "ডিপোজিট") },
    { id: "withdrawal", label: t("Withdrawal", "উইথড্র") },
    { id: "usdt", label: "USDT" },
  ];

  return (
    <div className="min-h-screen bg-[#0d241e] text-white">
      <LotteryHeader />

      <main className="mx-auto w-full max-w-[700px] px-3 pb-32 pt-5 sm:px-5">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white">
            {t("Transaction History", "লেনদেনের হিস্টোরি")}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {t(
              "View your deposit and withdrawal activities.",
              "আপনার ডিপোজিট ও উইথড্র লেনদেন দেখুন।"
            )}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl border border-[#294438] bg-[#142d23] p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[43px] rounded-lg px-2 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-[#184f35] text-white shadow-md"
                  : "bg-transparent text-gray-400 hover:bg-[#203b2e] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-[#294438] bg-[#1B2A23]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#315b45] border-t-green-400" />
            <p className="text-sm text-gray-400">
              {t("Loading transactions...", "লেনদেন লোড হচ্ছে...")}
            </p>
          </div>
        ) : currentError ? (
          <div className="rounded-xl border border-red-500/20 bg-[#1B2A23] px-4 py-8 text-center">
            <p className="text-sm text-red-400">{currentError}</p>
            <button
              type="button"
              onClick={loadTransactions}
              className="mt-4 rounded-lg bg-[#184f35] px-5 py-2 text-sm font-semibold text-white"
            >
              {t("Try Again", "আবার চেষ্টা করুন")}
            </button>
          </div>
        ) : currentHistory.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-[#294438] bg-[#1B2A23] px-4 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#294438] text-2xl">
              ↗
            </div>
            <p className="font-semibold text-gray-200">
              {t("No Transactions Found", "কোনো লেনদেন পাওয়া যায়নি")}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {t(
                "Your transaction history will appear here.",
                "আপনার লেনদেনের হিস্টোরি এখানে দেখা যাবে।"
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentHistory.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="rounded-xl border border-[#294438] bg-[#1B2A23] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {item.payment_method_name ||
                        item.payment_method_code ||
                        "—"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {item.type === "deposit"
                        ? t("Deposit", "ডিপোজিট")
                        : t("Withdrawal", "উইথড্র")}
                      {item.payment_method_code?.toLowerCase() === "usdt"
                        ? " • USDT"
                        : ""}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle(
                      item.status
                    )}`}
                  >
                    {getStatusLabel(item.status)}
                  </span>
                </div>

                <div className="my-3 border-t border-[#304238]" />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {t("Amount", "পরিমাণ")}
                  </span>
                  <span className="text-base font-bold text-white">
                    {Number(item.amount || 0).toLocaleString(undefined, {
                      maximumFractionDigits: 8,
                    })}
                  </span>
                </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {t("Tracking ID", "ট্র্যাকিং আইডি")}
                  </span>
                  <span className="max-w-[65%] break-all text-right text-xs text-gray-300">
                    {item.tracking_id || "—"}
                  </span>
                </div>

                {item.type === "deposit" && item.transaction_id && (
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <span className="text-xs text-gray-400">
                      {t("Transaction ID", "ট্রানজেকশন আইডি")}
                    </span>
                    <span className="max-w-[65%] break-all text-right text-xs text-gray-300">
                      {item.transaction_id}
                    </span>
                  </div>
                )}

                <div className="mt-2 flex items-start justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {t("Date", "তারিখ")}
                  </span>
                  <span className="text-right text-xs text-gray-300">
                    {formatDate(item.created_at)}
                  </span>
                </div>

                {item.rejection_reason && (
                  <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                    <p className="text-xs font-semibold text-red-400">
                      {t("Rejection Reason", "বাতিলের কারণ")}
                    </p>
                    <p className="mt-1 break-words text-xs text-gray-300">
                      {item.rejection_reason}
                    </p>
                  </div>
                )}

                {item.admin_note && (
                  <div className="mt-3 rounded-lg border border-[#365342] bg-[#142d23] p-3">
                    <p className="text-xs font-semibold text-green-400">
                      {t("Admin Note", "অ্যাডমিন নোট")}
                    </p>
                    <p className="mt-1 break-words text-xs text-gray-300">
                      {item.admin_note}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && currentHistory.length > 0 && (
          <p className="mt-4 text-center text-xs text-gray-500">
            {t("Total Transactions:", "মোট লেনদেন:")}{" "}
            {currentHistory.length}
          </p>
        )}
      </main>

      <LotteryFooter />
    </div>
  );
}
