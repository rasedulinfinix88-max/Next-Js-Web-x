
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase/client";
import { useLanguage } from "../../lib/LanguageContext";
import LotteryHeader from "../../components/Header/Header";
import LotteryFooter from "../../components/Footer/Footer";

type SupportTicket = {
  id: string;
  ticket_code: string;
  user_id: string;
  full_name: string;
  lottery_id: string;
  mobile_number: string;
  status: "unread" | "replied" | "ended";
  created_at: string;
  updated_at: string;
  ended_at: string | null;
};

type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: "user" | "super_admin";
  message_text: string;
  created_at: string;
};

type UserProfile = {
  full_name: string;
  lottery_id: string;
  user_mobile: string;
};

const MAX_WORDS = 200;

export default function SupportCenterPage() {
  const { t } = useLanguage();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [selectedTicket, setSelectedTicket] =
    useState<SupportTicket | null>(null);

  const [newMessage, setNewMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const getWordCount = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  };

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

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case "unread":
        return t("Unread", "নতুন মেসেজ");
      case "replied":
        return t("Replied", "উত্তর দেওয়া হয়েছে");
      case "ended":
        return t("Ended", "বন্ধ");
      default:
        return status || "—";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "unread":
        return "border-yellow-500/30 bg-yellow-500/15 text-yellow-400";
      case "replied":
        return "border-green-500/30 bg-green-500/15 text-green-400";
      case "ended":
        return "border-gray-500/30 bg-gray-500/15 text-gray-400";
      default:
        return "border-gray-500/30 bg-gray-500/15 text-gray-300";
    }
  };

  const loadSupportData = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        setProfile(null);
        setTickets([]);
        setSelectedTicket(null);

        setError(
          t(
            "Please login to access Support Center.",
            "সাপোর্ট সেন্টার ব্যবহার করতে লগইন করুন।"
          )
        );
        return;
      }

      const userId = authData.user.id;

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("full_name, lottery_id, user_mobile")
          .eq("id", userId)
          .single();

      if (profileError || !profileData) {
        throw new Error("Profile information could not be loaded.");
      }

      setProfile(profileData as UserProfile);

      const { data: ticketData, error: ticketError } =
        await supabase
          .from("support_tickets")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

      if (ticketError) {
        throw ticketError;
      }

      const loadedTickets = (ticketData || []) as SupportTicket[];

      setTickets(loadedTickets);

      setSelectedTicket((current) => {
        if (!current) return null;

        return (
          loadedTickets.find((ticket) => ticket.id === current.id) ||
          null
        );
      });
    } catch (err) {
      console.error("Support Center loading error:", err);

      setError(
        t(
          "Unable to load Support Center. Please try again.",
          "সাপোর্ট সেন্টার লোড করা যায়নি। আবার চেষ্টা করুন।"
        )
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadMessages = useCallback(
    async (ticketId: string) => {
      setMessagesLoading(true);
      setMessages([]);
      setError("");

      try {
        const { data, error: messageError } = await supabase
          .from("support_messages")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true });

        if (messageError) {
          throw messageError;
        }

        setMessages((data || []) as SupportMessage[]);
      } catch (err) {
        console.error("Support messages error:", err);

        setError(
          t(
            "Unable to load conversation. Please try again.",
            "কথোপকথন লোড করা যায়নি। আবার চেষ্টা করুন।"
          )
        );
      } finally {
        setMessagesLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    loadSupportData();
  }, [loadSupportData]);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
    } else {
      setMessages([]);
    }
  }, [selectedTicket?.id, loadMessages]);

  const createTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setNotice("");

    const message = newMessage.trim();
    const wordCount = getWordCount(message);

    if (!message) {
      setError(t("Please enter your problem.", "আপনার সমস্যাটি লিখুন।"));
      return;
    }

    if (wordCount > MAX_WORDS) {
      setError(
        t(
          "Your message cannot exceed 200 words.",
          "আপনার মেসেজ ২০০ শব্দের বেশি হতে পারবে না।"
        )
      );
      return;
    }

    setCreatingTicket(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "support_create_ticket",
        {
          p_message: message,
        }
      );

      if (rpcError) throw rpcError;

      if (!data || data.success !== true) {
        throw new Error(
          data?.message || "Unable to create support ticket."
        );
      }

      const createdTicketId = data.ticket_id as string;

      setNewMessage("");
      setShowNewTicket(false);

      await loadSupportData();

      if (createdTicketId) {
        const { data: createdTicket, error: createdTicketError } =
          await supabase
            .from("support_tickets")
            .select("*")
            .eq("id", createdTicketId)
            .single();

        if (createdTicketError) throw createdTicketError;

        setSelectedTicket(createdTicket as SupportTicket);
      }

      setNotice(
        t(
          "Your support ticket has been created successfully.",
          "আপনার সাপোর্ট টিকিট সফলভাবে তৈরি হয়েছে।"
        )
      );
    } catch (err) {
      console.error("Create support ticket error:", err);

      setError(
        t(
          "Unable to create ticket. Please try again.",
          "টিকিট তৈরি করা যায়নি। আবার চেষ্টা করুন।"
        )
      );
    } finally {
      setCreatingTicket(false);
    }
  };

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTicket || selectedTicket.status === "ended") return;

    setError("");
    setNotice("");

    const message = replyMessage.trim();
    const wordCount = getWordCount(message);

    if (!message) {
      setError(t("Please enter a message.", "একটি মেসেজ লিখুন।"));
      return;
    }

    if (wordCount > MAX_WORDS) {
      setError(
        t(
          "Your message cannot exceed 200 words.",
          "আপনার মেসেজ ২০০ শব্দের বেশি হতে পারবে না।"
        )
      );
      return;
    }

    setSendingMessage(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "support_send_message",
        {
          p_ticket_id: selectedTicket.id,
          p_message: message,
        }
      );

      if (rpcError) throw rpcError;

      if (data && data.success === false) {
        throw new Error(data.message || "Message could not be sent.");
      }

      setReplyMessage("");

      await loadMessages(selectedTicket.id);
      await loadSupportData();

      setNotice(
        t(
          "Your message has been sent.",
          "আপনার মেসেজ পাঠানো হয়েছে।"
        )
      );
    } catch (err) {
      console.error("Support reply error:", err);

      setError(
        t(
          "Unable to send message. Please try again.",
          "মেসেজ পাঠানো যায়নি। আবার চেষ্টা করুন।"
        )
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const openTicket = (ticket: SupportTicket) => {
    setError("");
    setNotice("");
    setReplyMessage("");
    setSelectedTicket(ticket);
    setShowNewTicket(false);
  };

  const startNewTicket = () => {
    setError("");
    setNotice("");
    setReplyMessage("");
    setNewMessage("");
    setSelectedTicket(null);
    setShowNewTicket(true);
  };

  const refreshAll = async () => {
    await loadSupportData();

    if (selectedTicket) {
      await loadMessages(selectedTicket.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d241e] text-white">
      <LotteryHeader />

      <main className="mx-auto w-full max-w-[700px] px-3 pb-32 pt-5 sm:px-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">
              {t("Support Center", "সাপোর্ট সেন্টার")}
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              {t(
                "Get help with your problems.",
                "আপনার সমস্যার জন্য সহায়তা নিন।"
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            disabled={loading || messagesLoading}
            className="shrink-0 rounded-lg border border-[#294438] bg-[#142d23] px-3 py-2 text-xs font-semibold text-green-400 transition-colors hover:bg-[#203b2e] disabled:opacity-50"
          >
            {t("Refresh", "রিফ্রেশ")}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-3 text-sm text-green-400">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-xl border border-[#294438] bg-[#1B2A23]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#315b45] border-t-green-400" />

            <p className="text-sm text-gray-400">
              {t("Loading Support Center...", "সাপোর্ট সেন্টার লোড হচ্ছে...")}
            </p>
          </div>
        ) : profile ? (
          <>
            <section className="mb-5 rounded-xl border border-[#294438] bg-[#142d23] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl">👤</span>
                <h2 className="text-sm font-bold text-white">
                  {t("Your Information", "আপনার তথ্য")}
                </h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">
                    {t("Full Name", "সম্পূর্ণ নাম")}
                  </label>

                  <div className="rounded-lg border border-[#294438] bg-[#0d241e] px-3 py-2.5 text-sm text-gray-200">
                    {profile.full_name || "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      {t("Lottery ID", "লটারি আইডি")}
                    </label>

                    <div className="break-all rounded-lg border border-[#294438] bg-[#0d241e] px-3 py-2.5 text-sm text-gray-200">
                      {profile.lottery_id || "—"}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      {t("Mobile Number", "মোবাইল নম্বর")}
                    </label>

                    <div className="break-all rounded-lg border border-[#294438] bg-[#0d241e] px-3 py-2.5 text-sm text-gray-200">
                      {profile.user_mobile || "—"}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-gray-500">
                {t(
                  "This information comes from your account and cannot be edited here.",
                  "এই তথ্য আপনার অ্যাকাউন্ট থেকে নেওয়া হয়েছে। এখানে পরিবর্তন করা যাবে না।"
                )}
              </p>
            </section>

            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  {t("My Support Tickets", "আমার সাপোর্ট টিকিট")}
                </h2>

                <p className="mt-1 text-xs text-gray-400">
                  {t("Total Tickets:", "মোট টিকিট:")} {tickets.length}
                </p>
              </div>

              <button
                type="button"
                onClick={startNewTicket}
                className="shrink-0 rounded-lg bg-[#184f35] px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#216443]"
              >
                + {t("New Ticket", "নতুন টিকিট")}
              </button>
            </div>

            {showNewTicket && (
              <form
                onSubmit={createTicket}
                className="mb-5 rounded-xl border border-[#294438] bg-[#1B2A23] p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-bold text-white">
                    {t("Create New Ticket", "নতুন টিকিট তৈরি করুন")}
                  </h3>

                  <button
                    type="button"
                    onClick={() => setShowNewTicket(false)}
                    className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-[#294438]"
                  >
                    ✕
                  </button>
                </div>

                <label className="mb-2 block text-xs text-gray-400">
                  {t("Describe Your Problem", "আপনার সমস্যাটি লিখুন")}
                </label>

                <textarea
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder={t(
                    "Write your problem here...",
                    "এখানে আপনার সমস্যাটি লিখুন..."
                  )}
                  className="w-full resize-y rounded-lg border border-[#304238] bg-[#0d241e] px-3 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-green-600"
                />

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`text-xs ${
                      getWordCount(newMessage) > MAX_WORDS
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {getWordCount(newMessage)} / {MAX_WORDS}{" "}
                    {t("words", "শব্দ")}
                  </span>

                  <button
                    type="submit"
                    disabled={
                      creatingTicket ||
                      !newMessage.trim() ||
                      getWordCount(newMessage) > MAX_WORDS
                    }
                    className="rounded-lg bg-[#184f35] px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {creatingTicket
                      ? t("Creating...", "তৈরি হচ্ছে...")
                      : t("Create Ticket", "টিকিট তৈরি করুন")}
                  </button>
                </div>
              </form>
            )}

            {tickets.length === 0 && !showNewTicket ? (
              <div className="mb-5 flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-[#294438] bg-[#1B2A23] px-4 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#294438] text-2xl">
                  🎧
                </div>

                <p className="font-semibold text-gray-200">
                  {t("No Support Tickets", "কোনো সাপোর্ট টিকিট নেই")}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {t(
                    "Create a ticket if you need help.",
                    "সাহায্য প্রয়োজন হলে নতুন টিকিট তৈরি করুন।"
                  )}
                </p>
              </div>
            ) : (
              <div className="mb-5 space-y-2">
                {tickets.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    onClick={() => openTicket(ticket)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedTicket?.id === ticket.id
                        ? "border-green-600 bg-[#184f35]/30"
                        : "border-[#294438] bg-[#1B2A23] hover:bg-[#203b2e]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-400">
                          {t("Ticket ID", "টিকিট আইডি")}
                        </p>

                        <p className="mt-1 break-all text-sm font-bold text-white">
                          {ticket.ticket_code}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${getStatusStyle(
                          ticket.status
                        )}`}
                      >
                        {getStatusLabel(ticket.status)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-400">
                        {t("Created:", "তৈরি:")}{" "}
                        {formatDate(ticket.created_at)}
                      </span>

                      <span className="text-xs font-semibold text-green-400">
                        {t("View Conversation", "কথোপকথন দেখুন")} →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedTicket && (
              <section className="overflow-hidden rounded-xl border border-[#294438] bg-[#1B2A23]">
                <div className="border-b border-[#304238] bg-[#142d23] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-400">
                        {t("Conversation", "কথোপকথন")}
                      </p>

                      <h3 className="mt-1 break-all text-sm font-bold text-white">
                        {selectedTicket.ticket_code}
                      </h3>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${getStatusStyle(
                        selectedTicket.status
                      )}`}
                    >
                      {getStatusLabel(selectedTicket.status)}
                    </span>
                  </div>

                  {selectedTicket.status === "ended" && (
                    <p className="mt-3 rounded-lg border border-gray-500/20 bg-gray-500/10 px-3 py-2 text-xs text-gray-400">
                      {t(
                        "This ticket has been ended. You can view the conversation, but cannot send more messages.",
                        "এই টিকিটটি বন্ধ করা হয়েছে। আপনি পুরোনো কথোপকথন দেখতে পারবেন, তবে নতুন মেসেজ পাঠাতে পারবেন না।"
                      )}
                    </p>
                  )}
                </div>

                <div className="max-h-[450px] min-h-[180px] space-y-3 overflow-y-auto p-3">
                  {messagesLoading ? (
                    <div className="flex min-h-[150px] items-center justify-center">
                      <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#315b45] border-t-green-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-500">
                      {t("No messages found.", "কোনো মেসেজ পাওয়া যায়নি।")}
                    </p>
                  ) : (
                    messages.map((message) => {
                      const isAdmin =
                        message.sender_role === "super_admin";

                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isAdmin ? "justify-start" : "justify-end"
                          }`}
                        >
                          <div
                            className={`max-w-[88%] rounded-xl border px-3 py-3 ${
                              isAdmin
                                ? "border-[#315b45] bg-[#142d23]"
                                : "border-green-700/40 bg-[#184f35]/40"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-4">
                              <span
                                className={`text-[11px] font-bold ${
                                  isAdmin
                                    ? "text-green-400"
                                    : "text-gray-200"
                                }`}
                              >
                                {isAdmin
                                  ? t("Super Admin", "সুপার অ্যাডমিন")
                                  : t("You", "আপনি")}
                              </span>

                              <span className="text-[10px] text-gray-500">
                                {formatDate(message.created_at)}
                              </span>
                            </div>

                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-200">
                              {message.message_text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedTicket.status !== "ended" && (
                  <form
                    onSubmit={sendReply}
                    className="border-t border-[#304238] bg-[#142d23] p-3"
                  >
                    <label className="mb-2 block text-xs font-semibold text-gray-300">
                      {t("Send a Message", "মেসেজ পাঠান")}
                    </label>

                    <textarea
                      value={replyMessage}
                      onChange={(event) =>
                        setReplyMessage(event.target.value)
                      }
                      rows={3}
                      maxLength={5000}
                      placeholder={t(
                        "Write your message...",
                        "আপনার মেসেজ লিখুন..."
                      )}
                      className="w-full resize-y rounded-lg border border-[#304238] bg-[#0d241e] px-3 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-green-600"
                    />

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`text-xs ${
                          getWordCount(replyMessage) > MAX_WORDS
                            ? "text-red-400"
                            : "text-gray-400"
                        }`}
                      >
                        {getWordCount(replyMessage)} / {MAX_WORDS}{" "}
                        {t("words", "শব্দ")}
                      </span>

                      <button
                        type="submit"
                        disabled={
                          sendingMessage ||
                          !replyMessage.trim() ||
                          getWordCount(replyMessage) > MAX_WORDS
                        }
                        className="rounded-lg bg-[#184f35] px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {sendingMessage
                          ? t("Sending...", "পাঠানো হচ্ছে...")
                          : t("Send Message", "মেসেজ পাঠান")}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}
          </>
        ) : null}
      </main>

      <LotteryFooter />
    </div>
  );
}
