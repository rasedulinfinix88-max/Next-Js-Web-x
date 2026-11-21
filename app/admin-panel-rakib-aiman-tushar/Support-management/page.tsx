
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

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

type StatusFilter = "all" | "unread" | "replied" | "ended";

export default function SupportManagementPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] =
    useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);

  const [replyMessage, setReplyMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data, error: queryError } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;

      const loadedTickets = (data || []) as SupportTicket[];

      setTickets(loadedTickets);

      setSelectedTicket((current) => {
        if (!current) return null;

        return (
          loadedTickets.find((ticket) => ticket.id === current.id) ||
          null
        );
      });
    } catch (err) {
      console.error("Admin support tickets error:", err);

      setError(
        "Unable to load support tickets. Please refresh and try again."
      );

      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (ticketId: string) => {
    setMessagesLoading(true);
    setMessages([]);
    setError("");

    try {
      const supabase = createClient();

      const { data, error: queryError } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (queryError) throw queryError;

      setMessages((data || []) as SupportMessage[]);
    } catch (err) {
      console.error("Admin support messages error:", err);

      setError(
        "Unable to load this conversation. Please try again."
      );
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      try {
        const result = await checkAdminAccess();

        if (!active) return;

        if (!result.allowed) {
          router.replace(
            "/admin-panel-rakib-aiman-tushar/Admin-login/"
          );
          return;
        }

        setAdminAllowed(true);
        setChecking(false);

        await loadTickets();
      } catch (err) {
        console.error("Admin verification error:", err);

        if (!active) return;

        router.replace(
          "/admin-panel-rakib-aiman-tushar/Admin-login/"
        );
      }
    }

    verifyAdmin();

    return () => {
      active = false;
    };
  }, [router, loadTickets]);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
    } else {
      setMessages([]);
    }
  }, [selectedTicket?.id, loadMessages]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const supabase = createClient();

      await supabase.auth.signOut();

      router.replace(
        "/admin-panel-rakib-aiman-tushar/Admin-login/"
      );
    } catch (err) {
      console.error("Admin logout error:", err);
      setLoggingOut(false);
    }
  }

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
        return "Unread";
      case "replied":
        return "Replied";
      case "ended":
        return "Ended";
      default:
        return status || "Unknown";
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

  const filteredTickets = tickets.filter((ticket) => {
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;

    const searchValue = search.trim().toLowerCase();

    const matchesSearch =
      !searchValue ||
      ticket.ticket_code.toLowerCase().includes(searchValue) ||
      ticket.full_name.toLowerCase().includes(searchValue) ||
      ticket.lottery_id.toLowerCase().includes(searchValue) ||
      ticket.mobile_number.toLowerCase().includes(searchValue);

    return matchesStatus && matchesSearch;
  });

  const unreadCount = tickets.filter(
    (ticket) => ticket.status === "unread"
  ).length;

  const repliedCount = tickets.filter(
    (ticket) => ticket.status === "replied"
  ).length;

  const endedCount = tickets.filter(
    (ticket) => ticket.status === "ended"
  ).length;

  async function handleSendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTicket || selectedTicket.status === "ended") return;

    const message = replyMessage.trim();

    if (!message) {
      setError("Please enter a reply message.");
      return;
    }

    setSending(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();

      const { error: rpcError } = await supabase.rpc(
        "support_send_message",
        {
          p_ticket_id: selectedTicket.id,
          p_message: message,
        }
      );

      if (rpcError) throw rpcError;

      setReplyMessage("");

      await loadMessages(selectedTicket.id);
      await loadTickets();

      setNotice("Your reply has been sent successfully.");
    } catch (err) {
      console.error("Admin support reply error:", err);

      setError(
        "Unable to send reply. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  async function handleEndTicket() {
    if (!selectedTicket || selectedTicket.status === "ended") return;

    const confirmed = window.confirm(
      `Are you sure you want to end ticket ${selectedTicket.ticket_code}? No more messages can be sent after ending it.`
    );

    if (!confirmed) return;

    setEnding(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();

      const { error: rpcError } = await supabase.rpc(
        "support_end_ticket",
        {
          p_ticket_id: selectedTicket.id,
        }
      );

      if (rpcError) throw rpcError;

      setSelectedTicket((current) =>
        current
          ? {
              ...current,
              status: "ended",
              ended_at: new Date().toISOString(),
            }
          : null
      );

      await loadTickets();

      setNotice(
        "Ticket has been ended successfully. The conversation remains available."
      );
    } catch (err) {
      console.error("End support ticket error:", err);

      setError(
        "Unable to end ticket. Please try again."
      );
    } finally {
      setEnding(false);
    }
  }

  function openTicket(ticket: SupportTicket) {
    setError("");
    setNotice("");
    setReplyMessage("");
    setSelectedTicket(ticket);
  }

  if (checking || !adminAllowed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#07110d]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#24543b] border-t-green-500" />

          <p className="text-sm text-gray-300">
            Verifying Administrator...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07110d] text-white">
      <header className="border-b border-[#24543b] bg-[#10251a] px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-green-400">
              GAZICASINO ADMIN
            </h1>

            <p className="mt-1 text-xs text-gray-400">
              Support Management
            </p>
          </div>

          <AdminMenu
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">
              🎧 Support Management
            </h2>

            <p className="mt-1 text-xs text-gray-400">
              Manage user support tickets and conversations.
            </p>
          </div>

          <button
            type="button"
            onClick={loadTickets}
            disabled={loading}
            className="rounded-lg border border-[#24543b] bg-[#10251a] px-4 py-2 text-xs font-semibold text-green-400 hover:bg-[#173827] disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            {notice}
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-[#24543b] bg-[#10251a] p-4">
            <p className="text-xs text-gray-400">Total Tickets</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {tickets.length.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl border border-yellow-500/20 bg-[#10251a] p-4">
            <p className="text-xs text-gray-400">Unread</p>
            <p className="mt-2 text-2xl font-bold text-yellow-400">
              {unreadCount.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl border border-green-500/20 bg-[#10251a] p-4">
            <p className="text-xs text-gray-400">Replied</p>
            <p className="mt-2 text-2xl font-bold text-green-400">
              {repliedCount.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl border border-gray-500/20 bg-[#10251a] p-4">
            <p className="text-xs text-gray-400">Ended</p>
            <p className="mt-2 text-2xl font-bold text-gray-400">
              {endedCount.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_190px]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Ticket ID, Name, Lottery ID or Mobile..."
            className="w-full rounded-lg border border-[#24543b] bg-[#10251a] px-3 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-green-500"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            className="rounded-lg border border-[#24543b] bg-[#10251a] px-3 py-3 text-sm text-white outline-none focus:border-green-500"
          >
            <option value="all">All Tickets</option>
            <option value="unread">Unread</option>
            <option value="replied">Replied</option>
            <option value="ended">Ended</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-white">
                Support Tickets
              </h3>

              <span className="text-xs text-gray-400">
                {filteredTickets.length} found
              </span>
            </div>

            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[#24543b] bg-[#10251a]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#24543b] border-t-green-500" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-xl border border-[#24543b] bg-[#10251a] px-4 py-12 text-center">
                <div className="mb-3 text-3xl">🎧</div>

                <p className="text-sm font-semibold text-gray-300">
                  No Support Tickets Found
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Tickets will appear here.
                </p>
              </div>
            ) : (
              <div className="max-h-[750px] space-y-2 overflow-y-auto pr-1">
                {filteredTickets.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    onClick={() => openTicket(ticket)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedTicket?.id === ticket.id
                        ? "border-green-500 bg-[#184f35]/30"
                        : "border-[#24543b] bg-[#10251a] hover:bg-[#173827]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-all text-sm font-bold text-white">
                          {ticket.ticket_code}
                        </p>

                        <p className="mt-1 truncate text-xs text-gray-300">
                          {ticket.full_name}
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
                      <span className="text-[11px] text-gray-500">
                        {ticket.lottery_id}
                      </span>

                      <span className="text-[10px] text-gray-500">
                        {formatDate(ticket.created_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0">
            <h3 className="mb-3 font-bold text-white">
              Ticket Conversation
            </h3>

            {!selectedTicket ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-[#24543b] bg-[#10251a] px-4 text-center">
                <div className="mb-3 text-4xl">💬</div>

                <p className="font-semibold text-gray-300">
                  Select a Support Ticket
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Choose a ticket from the list to view its conversation.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#24543b] bg-[#10251a]">
                <div className="border-b border-[#24543b] bg-[#10251a] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-400">
                        Ticket ID
                      </p>

                      <h4 className="mt-1 break-all text-base font-bold text-green-400">
                        {selectedTicket.ticket_code}
                      </h4>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getStatusStyle(
                        selectedTicket.status
                      )}`}
                    >
                      {getStatusLabel(selectedTicket.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-[#24543b] bg-[#07110d] p-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] text-gray-500">
                        User Name
                      </p>

                      <p className="mt-1 break-words text-sm font-semibold text-white">
                        {selectedTicket.full_name}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-500">
                        Lottery ID
                      </p>

                      <p className="mt-1 break-all text-sm font-semibold text-white">
                        {selectedTicket.lottery_id}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-500">
                        Mobile Number
                      </p>

                      <p className="mt-1 break-all text-sm font-semibold text-white">
                        {selectedTicket.mobile_number}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-500">
                        Created At
                      </p>

                      <p className="mt-1 text-xs text-gray-300">
                        {formatDate(selectedTicket.created_at)}
                      </p>
                    </div>
                  </div>

                  {selectedTicket.status !== "ended" && (
                    <button
                      type="button"
                      onClick={handleEndTicket}
                      disabled={ending}
                      className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {ending ? "Ending Ticket..." : "End This Ticket"}
                    </button>
                  )}

                  {selectedTicket.status === "ended" && (
                    <p className="mt-4 rounded-lg border border-gray-500/20 bg-gray-500/10 px-3 py-2 text-xs text-gray-400">
                      This ticket has been ended. The conversation is read-only.
                    </p>
                  )}
                </div>

                <div className="max-h-[500px] min-h-[220px] space-y-3 overflow-y-auto p-3 sm:p-4">
                  {messagesLoading ? (
                    <div className="flex min-h-[180px] items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#24543b] border-t-green-500" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="py-12 text-center text-sm text-gray-500">
                      No messages found.
                    </p>
                  ) : (
                    messages.map((message) => {
                      const isAdmin =
                        message.sender_role === "super_admin";

                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isAdmin ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[90%] rounded-xl border px-3 py-3 ${
                              isAdmin
                                ? "border-green-700/40 bg-[#184f35]/30"
                                : "border-[#315b45] bg-[#07110d]"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-4">
                              <span
                                className={`text-[11px] font-bold ${
                                  isAdmin
                                    ? "text-green-400"
                                    : "text-yellow-400"
                                }`}
                              >
                                {isAdmin ? "Super Admin" : "User"}
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
                    onSubmit={handleSendReply}
                    className="border-t border-[#24543b] bg-[#10251a] p-3 sm:p-4"
                  >
                    <label className="mb-2 block text-xs font-semibold text-gray-300">
                      Reply as Super Admin
                    </label>

                    <textarea
                      value={replyMessage}
                      onChange={(event) =>
                        setReplyMessage(event.target.value)
                      }
                      rows={4}
                      placeholder="Write your reply..."
                      className="w-full resize-y rounded-lg border border-[#24543b] bg-[#07110d] px-3 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-green-500"
                    />

                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={sending || !replyMessage.trim()}
                        className="rounded-lg bg-[#184f35] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#216443] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {sending ? "Sending..." : "Send Reply"}
                      </button>
                    </div>

                    <p className="mt-2 text-[10px] text-gray-500">
                      Super Admin messages have no 200-word limit.
                    </p>
                  </form>
                )}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
