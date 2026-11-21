
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
import { useLanguage } from "../../../lib/LanguageContext";
import LotteryHeader from "../../../components/Header/Header";
import LotteryFooter from "../../../components/Footer/Footer";

type Ticket = {
  ticket_id: string;
  ticket_number: string;
  draw_id: string;
  ticket_price: number | string;
  purchase_status: string;
  is_winner: boolean;
  prize_amount: number | string;
  purchased_at: string;
  draw_date: string;
  draw_status: string;
};

const PAGE_SIZE = 20;

export default function TicketTransactionsPage() {
  const { t } = useLanguage();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        setError(
          t(
            "Please login to view your ticket history.",
            "টিকিটের ইতিহাস দেখতে লগইন করুন।"
          )
        );
        setTickets([]);
        setTotal(0);
        return;
      }

      const { data, error: functionError } =
        await supabase.functions.invoke("ticket-manager", {
          body: {
            action: "my_tickets",
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          },
        });

      if (functionError) {
        throw functionError;
      }

      if (!data || data.success !== true) {
        throw new Error("Could not retrieve ticket history.");
      }

      setTickets(data.tickets || []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      console.error("Ticket history error:", err);

      setError(
        t(
          "Unable to load ticket history. Please try again.",
          "টিকিটের হিস্টোরি লোড করা যায়নি। আবার চেষ্টা করুন।"
        )
      );

      setTickets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const formatDate = (value: string) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (value: number | string) => {
    return Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 8,
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "valid":
      case "completed":
      case "open":
        return "border-green-500/30 bg-green-500/15 text-green-400";

      case "cancelled":
      case "canceled":
      case "invalid":
      case "rejected":
        return "border-red-500/30 bg-red-500/15 text-red-400";

      case "pending":
      case "scheduled":
        return "border-yellow-500/30 bg-yellow-500/15 text-yellow-400";

      default:
        return "border-gray-500/30 bg-gray-500/15 text-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    const value = status?.toLowerCase();

    if (value === "valid") return t("Valid", "বৈধ");
    if (value === "invalid") return t("Invalid", "অবৈধ");
    if (value === "cancelled" || value === "canceled") {
      return t("Cancelled", "বাতিল");
    }
    if (value === "pending") return t("Pending", "অপেক্ষমাণ");
    if (value === "open") return t("Open", "চালু");
    if (value === "scheduled") return t("Scheduled", "নির্ধারিত");
    if (value === "completed") return t("Completed", "সম্পন্ন");
    if (value === "rejected") return t("Rejected", "বাতিল");

    return status || "—";
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#0d241e] text-white">
      <LotteryHeader />

      <main className="mx-auto w-full max-w-[700px] px-3 pb-32 pt-5 sm:px-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">
              {t("Ticket History", "টিকিটের ইতিহাস")}
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              {t(
                "View your purchased tickets.",
                "আপনার কেনা টিকিটগুলোর তথ্য দেখুন।"
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={loadTickets}
            disabled={loading}
            className="shrink-0 rounded-lg border border-[#294438] bg-[#142d23] px-3 py-2 text-xs font-semibold text-green-400 transition-colors hover:bg-[#203b2e] disabled:opacity-50"
          >
            {t("Refresh", "রিফ্রেশ")}
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-[#294438] bg-[#142d23] p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">
                {t("Total Purchased Tickets", "মোট কেনা টিকিট")}
              </p>

              <p className="mt-1 text-2xl font-bold text-white">
                {total.toLocaleString()}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#184f35] text-2xl">
              🎟️
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-[#294438] bg-[#1B2A23]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#315b45] border-t-green-400" />

            <p className="text-sm text-gray-400">
              {t("Loading ticket history...", "টিকিটের ইতিহাস লোড হচ্ছে...")}
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-[#1B2A23] px-4 py-8 text-center">
            <p className="text-sm text-red-400">{error}</p>

            <button
              type="button"
              onClick={loadTickets}
              className="mt-4 rounded-lg bg-[#184f35] px-5 py-2 text-sm font-semibold text-white"
            >
              {t("Try Again", "আবার চেষ্টা করুন")}
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex min-h-[230px] flex-col items-center justify-center rounded-xl border border-[#294438] bg-[#1B2A23] px-4 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#294438] text-2xl">
              🎟️
            </div>

            <p className="font-semibold text-gray-200">
              {t("No Tickets Found", "কোনো টিকিট পাওয়া যায়নি")}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {t(
                "Your purchased tickets will appear here.",
                "আপনার কেনা টিকিটগুলো এখানে দেখা যাবে।"
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.ticket_id}
                className="rounded-xl border border-[#294438] bg-[#1B2A23] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-gray-400">
                      {t("Ticket Number", "টিকিট নম্বর")}
                    </p>

                    <p className="mt-1 break-all text-base font-bold text-white">
                      {ticket.ticket_number}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusStyle(
                      ticket.purchase_status
                    )}`}
                  >
                    {getStatusLabel(ticket.purchase_status)}
                  </span>
                </div>

                <div className="my-3 border-t border-[#304238]" />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {t("Ticket Price", "টিকিটের মূল্য")}
                  </span>

                  <span className="text-base font-bold text-white">
                    ৳{formatAmount(ticket.ticket_price)}
                  </span>
                </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {t("Purchase Date", "কেনার তারিখ")}
                  </span>

                  <span className="text-right text-xs text-gray-300">
                    {formatDate(ticket.purchased_at)}
                  </span>
                </div>

                <div className="mt-2 flex items-start justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {t("Draw Date", "ড্রয়ের তারিখ")}
                  </span>

                  <span className="text-right text-xs text-gray-300">
                    {ticket.draw_date
                      ? formatDate(ticket.draw_date)
                      : "—"}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {t("Draw Status", "ড্রয়ের অবস্থা")}
                  </span>

                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${getStatusStyle(
                      ticket.draw_status
                    )}`}
                  >
                    {getStatusLabel(ticket.draw_status)}
                  </span>
                </div>

                <div className="mt-3 border-t border-[#304238] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-400">
                      {t("Winner Status", "বিজয়ীর অবস্থা")}
                    </span>

                    <span
                      className={`text-xs font-bold ${
                        ticket.is_winner
                          ? "text-green-400"
                          : "text-gray-400"
                      }`}
                    >
                      {ticket.is_winner
                        ? t("Winner 🎉", "বিজয়ী 🎉")
                        : t("Not a Winner", "বিজয়ী নন")}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-400">
                      {t("Prize Amount", "পুরস্কারের পরিমাণ")}
                    </span>

                    <span
                      className={`text-sm font-bold ${
                        Number(ticket.prize_amount) > 0
                          ? "text-green-400"
                          : "text-white"
                      }`}
                    >
                      ৳{formatAmount(ticket.prize_amount)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && total > 0 && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-[#294438] bg-[#142d23] p-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0 || loading}
              className="rounded-lg bg-[#184f35] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("Previous", "আগের")}
            </button>

            <span className="text-xs text-gray-400">
              {t("Page", "পৃষ্ঠা")} {page + 1} / {Math.max(totalPages, 1)}
            </span>

            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages - 1, current + 1)
                )
              }
              disabled={page >= totalPages - 1 || loading}
              className="rounded-lg bg-[#184f35] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("Next", "পরবর্তী")}
            </button>
          </div>
        )}
      </main>

      <LotteryFooter />
    </div>
  );
}
