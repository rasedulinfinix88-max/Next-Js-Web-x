
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

type JackpotTicket = {
  id?: string;
  ticket_id?: string;
  ticket_number?: string;
  ticket_price?: number | string;
  purchase_status?: string;
  purchased_at?: string;
  created_at?: string;
  draw_date?: string;
  draw_at?: string;
  category?: string;
  prize_amount?: number | string;
  is_winner?: boolean;
  purchase_tracking_id?: string;
  [key: string]: unknown;
};

const PAGE_SIZE = 20;

export default function TicketTransactionsPage() {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<"lottery" | "jackpot">("lottery");

  // Existing Lottery states
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // Separate Jackpot states
  const [jackpotTickets, setJackpotTickets] = useState<JackpotTicket[]>([]);
  const [jackpotLoading, setJackpotLoading] = useState(false);
  const [jackpotError, setJackpotError] = useState("");
  const [jackpotPage, setJackpotPage] = useState(0);
  const [jackpotHasMore, setJackpotHasMore] = useState(false);

  // EXISTING LOTTERY FUNCTION - UNCHANGED
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

  // NEW JACKPOT FUNCTION - SEPARATE FROM LOTTERY
  const loadJackpotTickets = useCallback(async () => {
    setJackpotLoading(true);
    setJackpotError("");

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        setJackpotError(
          t(
            "Please login to view your Jackpot ticket history.",
            "Jackpot টিকিটের ইতিহাস দেখতে লগইন করুন।"
          )
        );
        setJackpotTickets([]);
        setJackpotHasMore(false);
        return;
      }

      const { data, error: functionError } =
        await supabase.functions.invoke("jackpot-manager", {
          body: {
            action: "my_tickets",
            limit: PAGE_SIZE + 1,
            offset: jackpotPage * PAGE_SIZE,
          },
        });

      if (functionError) {
        throw functionError;
      }

      if (!data || data.success !== true) {
        throw new Error("Could not retrieve Jackpot ticket history.");
      }

      const receivedTickets = Array.isArray(data.tickets)
        ? data.tickets
        : [];

      setJackpotHasMore(receivedTickets.length > PAGE_SIZE);

      setJackpotTickets(
        receivedTickets.slice(0, PAGE_SIZE)
      );
    } catch (err) {
      console.error("Jackpot ticket history error:", err);

      setJackpotError(
        t(
          "Unable to load Jackpot ticket history. Please try again.",
          "Jackpot টিকিটের হিস্টোরি লোড করা যায়নি। আবার চেষ্টা করুন।"
        )
      );

      setJackpotTickets([]);
      setJackpotHasMore(false);
    } finally {
      setJackpotLoading(false);
    }
  }, [jackpotPage, t]);

  // Existing Lottery initial loading
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Jackpot loads only when its tab is selected
  useEffect(() => {
    if (activeTab === "jackpot") {
      loadJackpotTickets();
    }
  }, [activeTab, loadJackpotTickets]);

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

  // Safe Jackpot field readers
  const jackpotText = (
    ticket: JackpotTicket,
    fields: string[]
  ): string => {
    for (const field of fields) {
      const value = ticket[field];

      if (
        typeof value === "string" &&
        value.trim() !== ""
      ) {
        return value;
      }
    }

    return "—";
  };

  const jackpotAmount = (
    ticket: JackpotTicket,
    fields: string[]
  ): number | string => {
    for (const field of fields) {
      const value = ticket[field];

      if (
        typeof value === "number" ||
        typeof value === "string"
      ) {
        return value;
      }
    }

    return 0;
  };

  const jackpotDate = (ticket: JackpotTicket) => {
    return jackpotText(ticket, [
      "purchased_at",
      "created_at",
    ]);
  };

  return (
    <div className="min-h-screen bg-[#0d241e] text-white">
      <LotteryHeader />

      <main className="mx-auto w-full max-w-[700px] px-3 pb-32 pt-5 sm:px-5">

        {/* HIDDEN: Ticket History heading, subtitle and Refresh */}
        <div className="hidden mb-5 flex items-center justify-between gap-3">
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
            onClick={
              activeTab === "lottery"
                ? loadTickets
                : loadJackpotTickets
            }
            disabled={
              activeTab === "lottery"
                ? loading
                : jackpotLoading
            }
            className="shrink-0 rounded-lg border border-[#294438] bg-[#142d23] px-3 py-2 text-xs font-semibold text-green-400 transition-colors hover:bg-[#203b2e] disabled:opacity-50"
          >
            {t("Refresh", "রিফ্রেশ")}
          </button>
        </div>

        {/* Separate Transaction Buttons */}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-[#294438] bg-[#142d23] p-2">

          <button
            type="button"
            onClick={() => setActiveTab("lottery")}
            className={`rounded-lg px-3 py-3 text-xs font-bold transition-colors ${
              activeTab === "lottery"
                ? "bg-[#184f35] text-white"
                : "bg-[#1B2A23] text-gray-400"
            }`}
          >
            {t("Lottery Transactions", "Lottery লেনদেন")}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("jackpot")}
            className={`rounded-lg px-3 py-3 text-xs font-bold transition-colors ${
              activeTab === "jackpot"
                ? "bg-[#184f35] text-white"
                : "bg-[#1B2A23] text-gray-400"
            }`}
          >
            {t("Jackpot Transactions", "Jackpot লেনদেন")}
          </button>

        </div>

        {/* LOTTERY TRANSACTIONS */}
        {activeTab === "lottery" && (
          <>
            {/* HIDDEN: Total Purchased Tickets */}
            <div className="hidden mb-5 rounded-xl border border-[#294438] bg-[#142d23] p-3">
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

                    {/* HIDDEN: Draw Status */}
                    <div className="hidden mt-2 flex items-center justify-between gap-3">
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

                    {/* HIDDEN: Winner Status and Prize Amount */}
                    <div className="hidden mt-3 border-t border-[#304238] pt-3">
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
                  onClick={() =>
                    setPage((current) => Math.max(0, current - 1))
                  }
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
          </>
        )}

        {/* JACKPOT TRANSACTIONS */}
        {activeTab === "jackpot" && (
          <>
            {/* HIDDEN: Jackpot Tickets on This Page */}
            <div className="hidden mb-5 rounded-xl border border-[#294438] bg-[#142d23] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">
                    {t("Jackpot Tickets on This Page", "এই পৃষ্ঠার Jackpot টিকিট")}
                  </p>

                  <p className="mt-1 text-2xl font-bold text-white">
                    {jackpotTickets.length.toLocaleString()}
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#184f35] text-2xl">
                  🎰
                </div>
              </div>
            </div>

            {jackpotLoading ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-[#294438] bg-[#1B2A23]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#315b45] border-t-green-400" />

                <p className="text-sm text-gray-400">
                  {t("Loading Jackpot history...", "Jackpot হিস্টোরি লোড হচ্ছে...")}
                </p>
              </div>
            ) : jackpotError ? (
              <div className="rounded-xl border border-red-500/20 bg-[#1B2A23] px-4 py-8 text-center">
                <p className="text-sm text-red-400">
                  {jackpotError}
                </p>

                <button
                  type="button"
                  onClick={loadJackpotTickets}
                  className="mt-4 rounded-lg bg-[#184f35] px-5 py-2 text-sm font-semibold text-white"
                >
                  {t("Try Again", "আবার চেষ্টা করুন")}
                </button>
              </div>
            ) : jackpotTickets.length === 0 ? (
              <div className="flex min-h-[230px] flex-col items-center justify-center rounded-xl border border-[#294438] bg-[#1B2A23] px-4 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#294438] text-2xl">
                  🎰
                </div>

                <p className="font-semibold text-gray-200">
                  {t("No Jackpot Tickets Found", "কোনো Jackpot টিকিট পাওয়া যায়নি")}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {t(
                    "Your purchased Jackpot tickets will appear here.",
                    "আপনার কেনা Jackpot টিকিটগুলো এখানে দেখা যাবে।"
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {jackpotTickets.map((ticket, index) => {
                  const ticketId =
                    jackpotText(ticket, ["id", "ticket_id"]);

                  const ticketNumber =
                    jackpotText(ticket, ["ticket_number"]);

                  const status =
                    jackpotText(ticket, ["purchase_status"]);

                  const purchaseDate = jackpotDate(ticket);

                  const drawDate =
                    jackpotText(ticket, ["draw_date", "draw_at"]);

                  const category =
                    jackpotText(ticket, ["category"]);

                  const price = jackpotAmount(ticket, [
                    "ticket_price",
                  ]);

                  const prize = jackpotAmount(ticket, [
                    "prize_amount",
                  ]);

                  const trackingId =
                    jackpotText(ticket, ["purchase_tracking_id"]);

                  const isWinner = ticket.is_winner === true;

                  return (
                    <div
                      key={ticketId !== "—" ? ticketId : `${ticketNumber}-${index}`}
                      className="rounded-xl border border-[#294438] bg-[#1B2A23] p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-gray-400">
                            {t("Jackpot Ticket Number", "Jackpot টিকিট নম্বর")}
                          </p>

                          <p className="mt-1 break-all text-base font-bold text-white">
                            {ticketNumber}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusStyle(status)}`}
                        >
                          {getStatusLabel(status)}
                        </span>
                      </div>

                      <div className="my-3 border-t border-[#304238]" />

                      {category !== "—" && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-400">
                            {t("Jackpot Category", "Jackpot ক্যাটাগরি")}
                          </span>

                          <span className="text-sm font-bold text-white">
                            {category}
                          </span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs text-gray-400">
                          {t("Ticket Price", "টিকিটের মূল্য")}
                        </span>

                        <span className="text-base font-bold text-white">
                          ৳{formatAmount(price)}
                        </span>
                      </div>

                      <div className="mt-3 flex items-start justify-between gap-3">
                        <span className="text-xs text-gray-400">
                          {t("Purchase Date", "কেনার তারিখ")}
                        </span>

                        <span className="text-right text-xs text-gray-300">
                          {purchaseDate !== "—"
                            ? formatDate(purchaseDate)
                            : "—"}
                        </span>
                      </div>

                      <div className="mt-2 flex items-start justify-between gap-3">
                        <span className="text-xs text-gray-400">
                          {t("Draw Date", "ড্রয়ের তারিখ")}
                        </span>

                        <span className="text-right text-xs text-gray-300">
                          {drawDate !== "—"
                            ? formatDate(drawDate)
                            : "—"}
                        </span>
                      </div>

                      {trackingId !== "—" && (
                        <div className="mt-2 flex items-start justify-between gap-3">
                          <span className="text-xs text-gray-400">
                            {t("Purchase Tracking ID", "Purchase Tracking ID")}
                          </span>

                          <span className="max-w-[65%] break-all text-right text-xs text-gray-300">
                            {trackingId}
                          </span>
                        </div>
                      )}

                      {(ticket.is_winner !== undefined ||
                        Number(prize) > 0) && (
                        <div className="mt-3 border-t border-[#304238] pt-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-gray-400">
                              {t("Winner Status", "বিজয়ীর অবস্থা")}
                            </span>

                            <span
                              className={`text-xs font-bold ${
                                isWinner
                                  ? "text-green-400"
                                  : "text-gray-400"
                              }`}
                            >
                              {isWinner
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
                                Number(prize) > 0
                                  ? "text-green-400"
                                  : "text-white"
                              }`}
                            >
                              ৳{formatAmount(prize)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!jackpotLoading && !jackpotError && (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-[#294438] bg-[#142d23] p-3">
                <button
                  type="button"
                  onClick={() =>
                    setJackpotPage((current) =>
                      Math.max(0, current - 1)
                    )
                  }
                  disabled={jackpotPage === 0 || jackpotLoading}
                  className="rounded-lg bg-[#184f35] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("Previous", "আগের")}
                </button>

                <span className="text-xs text-gray-400">
                  {t("Page", "পৃষ্ঠা")} {jackpotPage + 1}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setJackpotPage((current) => current + 1)
                  }
                  disabled={!jackpotHasMore || jackpotLoading}
                  className="rounded-lg bg-[#184f35] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("Next", "পরবর্তী")}
                </button>
              </div>
            )}
          </>
        )}

      </main>

      <LotteryFooter />
    </div>
  );
}
