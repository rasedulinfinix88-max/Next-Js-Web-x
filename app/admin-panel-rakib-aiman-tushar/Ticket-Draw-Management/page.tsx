
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import AdminMenu from "../../../components/admin/AdminMenu";

type TicketDraw = {
  id: string;
  draw_date: string;
  draw_open_at?: string | null;
  status: "upcoming" | "open" | "completed";
  ticket_price: number | string;
  prize_amount: number | string;
  total_jackpot: number | string;
  total_tickets_sold: number | string;
  ticket_count?: number;
  eligible_ticket_count?: number;
};

type AdminProfile = {
  id: string;
  user_role: string;
  account_status: string;
  [key: string]: unknown;
};

type Notice = {
  type: "success" | "error" | "info";
  text: string;
};

type PendingAction = {
  type: "open" | "winner";
  draw: TicketDraw;
};

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString("en-BD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function toLocalDateTimeInput(value?: string | null, drawDate?: string) {
  const date = value
    ? new Date(value)
    : new Date(`${drawDate || getLocalDate()}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return `${drawDate || getLocalDate()}T00:00`;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDrawRows(data: unknown): TicketDraw[] {
  if (Array.isArray(data)) return data as TicketDraw[];

  if (data && typeof data === "object") {
    const result = data as Record<string, unknown>;

    if (Array.isArray(result.draws)) {
      return result.draws as TicketDraw[];
    }

    if (Array.isArray(result.data)) {
      return result.data as TicketDraw[];
    }

    if (Array.isArray(result.result)) {
      return result.result as TicketDraw[];
    }
  }

  return [];
}

export default function TicketDrawManagementPage() {
  const router = useRouter();
  const client = useMemo(() => supabase, []);

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [draws, setDraws] = useState<TicketDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [drawDate, setDrawDate] = useState(getLocalDate());
  const [ticketPrice, setTicketPrice] = useState("50");
  const [prizeAmount, setPrizeAmount] = useState("10000");
  const [totalJackpot, setTotalJackpot] = useState("0");

  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingAction, setPendingAction] =
    useState<PendingAction | null>(null);

  // NEW: Edit Draw States
  const [editingDraw, setEditingDraw] = useState<TicketDraw | null>(null);
  const [editDrawDate, setEditDrawDate] = useState("");
  const [editDrawOpenAt, setEditDrawOpenAt] = useState("");
  const [editTicketPrice, setEditTicketPrice] = useState("");
  const [editPrizeAmount, setEditPrizeAmount] = useState("");
  const [editTotalJackpot, setEditTotalJackpot] = useState("");

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await client.auth.signOut();
      router.replace("/admin-panel-rakib-aiman-tushar/Admin-login/");
    } catch (error) {
      console.error("Admin logout error:", error);
      setLoggingOut(false);
    }
  }

  const loadDraws = useCallback(async () => {
    const { data, error } = await client.rpc("admin_list_ticket_draws");

    if (error) {
      throw error;
    }

    setDraws(getDrawRows(data));
  }, [client]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const {
          data: { user },
          error: authError,
        } = await client.auth.getUser();

        if (authError || !user) {
          router.replace("/user/login/");
          return;
        }

        const { data: profileData, error: profileError } = await client
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError || !profileData) {
          if (active) {
            setNotice({
              type: "error",
              text: "Admin profile যাচাই করা যায়নি।",
            });
          }
          return;
        }

        if (
          profileData.user_role !== "super_admin" ||
          profileData.account_status !== "active"
        ) {
          if (active) {
            setNotice({
              type: "error",
              text: "এই পেজ ব্যবহারের অনুমতি আপনার নেই।",
            });
          }
          return;
        }

        if (!active) return;

        setProfile(profileData as AdminProfile);
        setAuthorized(true);

        const { data, error } = await client.rpc(
          "admin_list_ticket_draws"
        );

        if (error) throw error;

        if (active) {
          setDraws(getDrawRows(data));
        }
      } catch (error) {
        console.error("Admin initialization error:", error);

        if (active) {
          setNotice({
            type: "error",
            text: "Admin Panel লোড করা যায়নি। আবার চেষ্টা করুন।",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [client, router]);

  async function handleCreateDraw(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setNotice(null);

    const price = Number(ticketPrice);
    const prize = Number(prizeAmount);
    const jackpot = Number(totalJackpot);

    if (!drawDate || drawDate < getLocalDate()) {
      setNotice({
        type: "error",
        text: "আজকের আগের তারিখ দিয়ে Draw তৈরি করা যাবে না।",
      });
      return;
    }

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(prize) ||
      prize <= 0 ||
      !Number.isFinite(jackpot) ||
      jackpot < 0
    ) {
      setNotice({
        type: "error",
        text: "Ticket Price, Prize Amount ও Jackpot সঠিকভাবে দিন।",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await client.rpc(
        "admin_create_ticket_draw",
        {
          p_draw_date: drawDate,
          p_ticket_price: price,
          p_prize_amount: prize,
          p_total_jackpot: jackpot,
        }
      );

      if (error) throw error;

      if (
        data &&
        typeof data === "object" &&
        "success" in data &&
        (data as { success: boolean }).success === false
      ) {
        throw new Error(
          String((data as { message?: string }).message || "Draw তৈরি হয়নি।")
        );
      }

      setNotice({
        type: "success",
        text: "নতুন Ticket Draw সফলভাবে তৈরি হয়েছে।",
      });

      setDrawDate(getLocalDate());
      await loadDraws();
    } catch (error) {
      console.error("Create draw error:", error);

      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Draw তৈরি করা যায়নি।",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // NEW: Open Edit Modal
  function openEditModal(draw: TicketDraw) {
    setEditingDraw(draw);
    setEditDrawDate(draw.draw_date);
    setEditDrawOpenAt(
      toLocalDateTimeInput(draw.draw_open_at, draw.draw_date)
    );
    setEditTicketPrice(String(draw.ticket_price ?? "0"));
    setEditPrizeAmount(String(draw.prize_amount ?? "0"));
    setEditTotalJackpot(String(draw.total_jackpot ?? "0"));
    setNotice(null);
  }

  // NEW: Close Edit Modal
  function closeEditModal() {
    if (submitting) return;

    setEditingDraw(null);
    setEditDrawDate("");
    setEditDrawOpenAt("");
    setEditTicketPrice("");
    setEditPrizeAmount("");
    setEditTotalJackpot("");
  }

  // NEW: Update Draw
  async function handleUpdateDraw(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingDraw) return;

    setNotice(null);

    const price = Number(editTicketPrice);
    const prize = Number(editPrizeAmount);
    const jackpot = Number(editTotalJackpot);

    if (!editDrawDate) {
      setNotice({
        type: "error",
        text: "Draw Date নির্বাচন করুন।",
      });
      return;
    }

    if (!editDrawOpenAt) {
      setNotice({
        type: "error",
        text: "Draw Opening Date ও Time নির্বাচন করুন।",
      });
      return;
    }

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(prize) ||
      prize <= 0 ||
      !Number.isFinite(jackpot) ||
      jackpot < 0
    ) {
      setNotice({
        type: "error",
        text: "Ticket Price, Prize Amount ও Jackpot সঠিকভাবে দিন।",
      });
      return;
    }

    setSubmitting(true);

    try {
      const openingDateTime = new Date(editDrawOpenAt);

      if (Number.isNaN(openingDateTime.getTime())) {
        throw new Error("Opening Date ও Time সঠিক নয়।");
      }

      const { data, error } = await client.rpc(
        "admin_update_ticket_draw",
        {
          p_draw_id: editingDraw.id,
          p_draw_date: editDrawDate,
          p_draw_open_at: openingDateTime.toISOString(),
          p_ticket_price: price,
          p_prize_amount: prize,
          p_total_jackpot: jackpot,
        }
      );

      if (error) throw error;

      if (
        data &&
        typeof data === "object" &&
        "success" in data &&
        (data as { success: boolean }).success === false
      ) {
        throw new Error(
          String(
            (data as { message?: string }).message ||
              "Draw Update করা যায়নি।"
          )
        );
      }

      setEditingDraw(null);

      setNotice({
        type: "success",
        text: "Draw-এর তথ্য সফলভাবে Update হয়েছে।",
      });

      await loadDraws();
    } catch (error) {
      console.error("Update draw error:", error);

      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Draw Update করা যায়নি।",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function executeAction() {
    if (!pendingAction) return;

    const action = pendingAction;
    setSubmitting(true);
    setNotice(null);

    try {
      let data: unknown;
      let error: { message: string } | null;

      if (action.type === "open") {
        const response = await client.rpc("admin_open_ticket_draw", {
          p_draw_id: action.draw.id,
        });

        data = response.data;
        error = response.error;
      } else {
        const response = await client.rpc("admin_pick_ticket_winner", {
          p_draw_id: action.draw.id,
        });

        data = response.data;
        error = response.error;
      }

      if (error) throw error;

      if (
        data &&
        typeof data === "object" &&
        "success" in data &&
        (data as { success: boolean }).success === false
      ) {
        throw new Error(
          String((data as { message?: string }).message || "Action failed.")
        );
      }

      if (action.type === "open") {
        setNotice({
          type: "success",
          text: "Draw সফলভাবে Open হয়েছে।",
        });
      } else {
        const result =
          data && typeof data === "object"
            ? (data as Record<string, unknown>)
            : {};

        const ticketNumber =
          result.ticket_number ??
          result.winning_ticket_number ??
          (result.winner &&
          typeof result.winner === "object"
            ? (result.winner as Record<string, unknown>).ticket_number
            : null);

        setNotice({
          type: "success",
          text: ticketNumber
            ? `Winner নির্বাচন সম্পন্ন। Winning Ticket: ${String(ticketNumber)}`
            : "Winner নির্বাচন সম্পন্ন হয়েছে।",
        });
      }

      setPendingAction(null);
      await loadDraws();
    } catch (error) {
      console.error("Draw action error:", error);

      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "কাজটি সম্পন্ন করা যায়নি।",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="tdm-loading">
        <div className="tdm-spinner" />
        <p>VERIFYING ADMIN ACCESS...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="tdm-page">
        <div className="tdm-denied">
          <div className="tdm-denied-icon">!</div>
          <h1>Access Denied</h1>
          <p>
            এই পেজ শুধুমাত্র Active Super Admin ব্যবহার করতে পারবেন।
          </p>
          <button onClick={() => router.replace("/")}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const upcomingCount = draws.filter(
    (draw) => draw.status === "upcoming"
  ).length;

  const openCount = draws.filter(
    (draw) => draw.status === "open"
  ).length;

  const completedCount = draws.filter(
    (draw) => draw.status === "completed"
  ).length;

  // NEW: Determine which financial fields can be edited
  const editTicketCount = editingDraw
    ? Number(
        editingDraw.ticket_count ??
          editingDraw.total_tickets_sold ??
          0
      )
    : 0;

  const completedEdit = editingDraw?.status === "completed";

  const lockedOpenFinancials =
    editingDraw?.status === "open" && editTicketCount > 0;

  const financialFieldsDisabled =
    Boolean(completedEdit || lockedOpenFinancials);

  return (
    <div className="tdm-page">
      <header className="border-b border-[#24543b] bg-[#10251a] px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-green-400">
              GAZICASINO ADMIN
            </h1>
            <p className="mt-1 text-xs text-gray-400">
              Ticket Draw Management
            </p>
          </div>

          <AdminMenu
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </div>
      </header>

      <main className="tdm-main">
        <div className="tdm-heading">
          <div>
            <span className="tdm-eyebrow">ADMIN CONTROL CENTER</span>
            <h1>Ticket Draw Management</h1>
            <p>Manage lottery draws and winner selection.</p>
          </div>

          <div className="tdm-admin-tag">
            <span className="tdm-online-dot" />
            SUPER ADMIN
          </div>
        </div>

        {notice && (
          <div className={`tdm-notice ${notice.type}`}>
            <span>{notice.type === "success" ? "✓" : "!"}</span>
            {notice.text}
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Close message"
            >
              ×
            </button>
          </div>
        )}

        <section className="tdm-stats">
          <div className="tdm-stat-card">
            <span>Total Draws</span>
            <strong>{draws.length}</strong>
          </div>
          <div className="tdm-stat-card">
            <span>Upcoming</span>
            <strong>{upcomingCount}</strong>
          </div>
          <div className="tdm-stat-card">
            <span>Open</span>
            <strong>{openCount}</strong>
          </div>
          <div className="tdm-stat-card">
            <span>Completed</span>
            <strong>{completedCount}</strong>
          </div>
        </section>

        <section className="tdm-panel">
          <div className="tdm-panel-heading">
            <div>
              <span className="tdm-section-label">CREATE NEW</span>
              <h2>Create Ticket Draw</h2>
            </div>
            <span className="tdm-plus-icon">+</span>
          </div>

          <form onSubmit={handleCreateDraw} className="tdm-form">
            <label>
              Draw Date
              <input
                type="date"
                value={drawDate}
                min={getLocalDate()}
                onChange={(event) => setDrawDate(event.target.value)}
                required
              />
            </label>

            <label>
              Ticket Price (৳)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={ticketPrice}
                onChange={(event) => setTicketPrice(event.target.value)}
                required
              />
            </label>

            <label>
              Prize Amount (৳)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={prizeAmount}
                onChange={(event) => setPrizeAmount(event.target.value)}
                required
              />
            </label>

            <label>
              Total Jackpot (৳)
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalJackpot}
                onChange={(event) => setTotalJackpot(event.target.value)}
                required
              />
            </label>

            <button
              type="submit"
              className="tdm-primary-button"
              disabled={submitting}
            >
              {submitting ? "PROCESSING..." : "＋ CREATE DRAW"}
            </button>
          </form>
        </section>

        <section className="tdm-panel">
          <div className="tdm-panel-heading">
            <div>
              <span className="tdm-section-label">DRAW OVERVIEW</span>
              <h2>All Ticket Draws</h2>
            </div>

            <button
              className="tdm-refresh-button"
              type="button"
              disabled={submitting}
              onClick={async () => {
                try {
                  await loadDraws();
                  setNotice({
                    type: "success",
                    text: "Draw list আপডেট হয়েছে।",
                  });
                } catch {
                  setNotice({
                    type: "error",
                    text: "Draw list লোড করা যায়নি।",
                  });
                }
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {draws.length === 0 ? (
            <div className="tdm-empty">
              <div>▤</div>
              <strong>No Ticket Draws Found</strong>
              <p>প্রথম Draw তৈরি করতে উপরের Form ব্যবহার করুন।</p>
            </div>
          ) : (
            <div className="tdm-draw-list">
              {draws.map((draw) => {
                const ticketCount = Number(
                  draw.ticket_count ?? draw.total_tickets_sold ?? 0
                );

                const eligibleCount = Number(
                  draw.eligible_ticket_count ?? 0
                );

                return (
                  <article className="tdm-draw-card" key={draw.id}>
                    <div className="tdm-draw-top">
                      <div>
                        <span className="tdm-draw-date-label">
                          DRAW DATE
                        </span>
                        <h3>{formatDate(draw.draw_date)}</h3>
                      </div>

                      <span
                        className={`tdm-status ${draw.status}`}
                      >
                        {draw.status}
                      </span>
                    </div>

                    <div className="tdm-draw-info">
                      <div>
                        <span>Opening Date & Time</span>
                        <strong>
                          {formatDateTime(draw.draw_open_at)}
                        </strong>
                      </div>

                      <div>
                        <span>Ticket Price</span>
                        <strong>৳{money(draw.ticket_price)}</strong>
                      </div>
                      <div>
                        <span>Prize Amount</span>
                        <strong>৳{money(draw.prize_amount)}</strong>
                      </div>
                      <div>
                        <span>Total Jackpot</span>
                        <strong>৳{money(draw.total_jackpot)}</strong>
                      </div>
                      <div>
                        <span>Tickets Sold</span>
                        <strong>{ticketCount.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span>Eligible Tickets</span>
                        <strong>{eligibleCount.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="tdm-draw-actions">
                      <button
                        type="button"
                        className="tdm-edit-button"
                        disabled={submitting}
                        onClick={() => openEditModal(draw)}
                      >
                        ✎ EDIT DRAW
                      </button>

                      {draw.status === "upcoming" && (
                        <button
                          type="button"
                          className="tdm-open-button"
                          disabled={submitting}
                          onClick={() =>
                            setPendingAction({
                              type: "open",
                              draw,
                            })
                          }
                        >
                          OPEN DRAW
                        </button>
                      )}

                      {draw.status === "open" && (
                        <button
                          type="button"
                          className="tdm-winner-button"
                          disabled={submitting || eligibleCount <= 0}
                          onClick={() =>
                            setPendingAction({
                              type: "winner",
                              draw,
                            })
                          }
                        >
                          SELECT WINNER
                        </button>
                      )}

                      {draw.status === "completed" && (
                        <span className="tdm-completed-label">
                          ✓ DRAW COMPLETED
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="tdm-security-note">
          <strong>Security Notice</strong>
          <p>
            এই পেজে Active Super Admin যাচাই করা হয়। Create, Open
            এবং Winner Selection-এর চূড়ান্ত অনুমতি বিদ্যমান
            Supabase RPC Function যাচাই করে।
          </p>
        </div>
      </main>

      {/* NEW: EDIT DRAW MODAL */}
      {editingDraw && (
        <div
          className="tdm-modal-backdrop"
          onClick={() => {
            if (!submitting) closeEditModal();
          }}
        >
          <div
            className="tdm-edit-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tdm-edit-modal-heading">
              <div>
                <span className="tdm-section-label">DRAW MANAGEMENT</span>
                <h2>Edit Ticket Draw</h2>
                <p>
                  Status:{" "}
                  <span className={`tdm-status ${editingDraw.status}`}>
                    {editingDraw.status}
                  </span>
                </p>
              </div>

              <button
                type="button"
                className="tdm-edit-close"
                disabled={submitting}
                onClick={closeEditModal}
              >
                ×
              </button>
            </div>

            {completedEdit && (
              <div className="tdm-edit-info">
                Completed Draw: শুধু Draw Date ও Opening Date/Time
                পরিবর্তন করা যাবে। Prize ও Financial Records অপরিবর্তিত থাকবে।
              </div>
            )}

            {lockedOpenFinancials && (
              <div className="tdm-edit-info">
                এই Open Draw-এ Ticket বিক্রি হয়েছে। Ticket Price ও
                Prize Amount পরিবর্তন করা যাবে না।
              </div>
            )}

            <form onSubmit={handleUpdateDraw} className="tdm-edit-form">
              <label>
                Draw Date
                <input
                  type="date"
                  value={editDrawDate}
                  onChange={(event) =>
                    setEditDrawDate(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Draw Opening Date & Time
                <input
                  type="datetime-local"
                  value={editDrawOpenAt}
                  onChange={(event) =>
                    setEditDrawOpenAt(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Ticket Price (৳)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editTicketPrice}
                  onChange={(event) =>
                    setEditTicketPrice(event.target.value)
                  }
                  disabled={financialFieldsDisabled}
                  required
                />
              </label>

              <label>
                Prize Amount (৳)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editPrizeAmount}
                  onChange={(event) =>
                    setEditPrizeAmount(event.target.value)
                  }
                  disabled={financialFieldsDisabled}
                  required
                />
              </label>

              <label>
                Total Jackpot (৳)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editTotalJackpot}
                  onChange={(event) =>
                    setEditTotalJackpot(event.target.value)
                  }
                  disabled={completedEdit}
                  required
                />
              </label>

              <div className="tdm-edit-modal-actions">
                <button
                  type="button"
                  className="tdm-cancel-button"
                  disabled={submitting}
                  onClick={closeEditModal}
                >
                  CANCEL
                </button>

                <button
                  type="submit"
                  className="tdm-save-button"
                  disabled={submitting}
                >
                  {submitting ? "SAVING..." : "SAVE CHANGES"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingAction && (
        <div
          className="tdm-modal-backdrop"
          onClick={() => {
            if (!submitting) setPendingAction(null);
          }}
        >
          <div
            className="tdm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tdm-modal-icon">
              {pendingAction.type === "winner" ? "★" : "↗"}
            </div>

            <h2>
              {pendingAction.type === "winner"
                ? "Select Draw Winner?"
                : "Open This Draw?"}
            </h2>

            <p>
              Draw Date: {formatDate(pendingAction.draw.draw_date)}
            </p>

            {pendingAction.type === "winner" ? (
              <p className="tdm-warning-text">
                Winner নির্বাচন একটি গুরুত্বপূর্ণ কাজ। এটি সম্পন্ন
                হলে Draw Completed হয়ে যাবে।
              </p>
            ) : (
              <p>
                Draw Open হলে User-রা Ticket কিনতে পারবেন।
              </p>
            )}

            <div className="tdm-modal-actions">
              <button
                type="button"
                className="tdm-cancel-button"
                disabled={submitting}
                onClick={() => setPendingAction(null)}
              >
                CANCEL
              </button>

              <button
                type="button"
                className="tdm-confirm-button"
                disabled={submitting}
                onClick={executeAction}
              >
                {submitting ? "PLEASE WAIT..." : "CONFIRM"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .tdm-page {
          min-height: 100vh;
          background: #07110d;
          color: #ffffff;
        }

        .tdm-main {
          width: 100%;
          max-width: 1050px;
          margin: 0 auto;
          padding: 24px 16px 55px;
          box-sizing: border-box;
        }

        .tdm-loading {
          min-height: 100vh;
          background: #07110d;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #d8e8df;
          gap: 16px;
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: 800;
        }

        .tdm-spinner {
          width: 38px;
          height: 38px;
          border: 3px solid #29483a;
          border-top-color: #00c878;
          border-radius: 50%;
          animation: tdm-spin 0.8s linear infinite;
        }

        @keyframes tdm-spin {
          to { transform: rotate(360deg); }
        }

        .tdm-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }

        .tdm-eyebrow,
        .tdm-section-label {
          color: #00c878;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.7px;
        }

        .tdm-heading h1 {
          font-size: clamp(21px, 5vw, 29px);
          margin: 7px 0;
          font-weight: 900;
        }

        .tdm-heading p {
          margin: 0;
          color: #9bb2a5;
          font-size: 12px;
        }

        .tdm-admin-tag {
          display: flex;
          align-items: center;
          gap: 7px;
          background: #193a2d;
          border: 1px solid #285440;
          border-radius: 30px;
          padding: 9px 12px;
          color: #7df0b8;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        .tdm-online-dot {
          width: 7px;
          height: 7px;
          background: #00d987;
          border-radius: 50%;
          box-shadow: 0 0 8px #00d987;
        }

        .tdm-notice {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 13px;
          margin-bottom: 16px;
          border-radius: 9px;
          font-size: 12px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .tdm-notice.success {
          background: #123c2a;
          border: 1px solid #23794d;
          color: #a5f3c5;
        }

        .tdm-notice.error {
          background: #421e23;
          border: 1px solid #873b43;
          color: #ffc1c1;
        }

        .tdm-notice.info {
          background: #183247;
          border: 1px solid #315c79;
          color: #b8e4ff;
        }

        .tdm-notice button {
          margin-left: auto;
          background: none;
          border: 0;
          color: inherit;
          font-size: 22px;
          cursor: pointer;
        }

        .tdm-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .tdm-stat-card {
          background: #162f25;
          border: 1px solid #284537;
          border-radius: 11px;
          padding: 15px;
        }

        .tdm-stat-card span {
          display: block;
          color: #9bb5a7;
          font-size: 11px;
          margin-bottom: 8px;
        }

        .tdm-stat-card strong {
          font-size: 24px;
          font-weight: 900;
          color: #ffffff;
        }

        .tdm-panel {
          background: #142b22;
          border: 1px solid #294537;
          border-radius: 13px;
          padding: 17px;
          margin-bottom: 18px;
        }

        .tdm-panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 18px;
        }

        .tdm-panel-heading h2 {
          margin: 6px 0 0;
          font-size: 17px;
          font-weight: 850;
        }

        .tdm-plus-icon {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #1d543b;
          color: #7df0b8;
          font-size: 23px;
        }

        .tdm-form {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .tdm-form label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #b8cfc2;
          font-size: 11px;
          font-weight: 750;
        }

        .tdm-form input {
          width: 100%;
          min-height: 45px;
          padding: 10px 12px;
          box-sizing: border-box;
          background: #0e211a;
          color: #ffffff;
          border: 1px solid #345444;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          color-scheme: dark;
        }

        .tdm-form input:focus {
          border-color: #00c878;
          box-shadow: 0 0 0 2px #00c87822;
        }

        .tdm-primary-button,
        .tdm-open-button,
        .tdm-winner-button,
        .tdm-confirm-button {
          border: 0;
          border-radius: 8px;
          min-height: 43px;
          padding: 11px 14px;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .tdm-primary-button {
          width: 100%;
          margin-top: 4px;
          background: #00c878;
          color: #062318;
        }

        .tdm-primary-button:disabled,
        .tdm-open-button:disabled,
        .tdm-winner-button:disabled,
        .tdm-refresh-button:disabled,
        .tdm-confirm-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tdm-refresh-button {
          border: 1px solid #38614b;
          border-radius: 7px;
          background: #1b3a2c;
          color: #a7edc6;
          padding: 9px 12px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .tdm-empty {
          text-align: center;
          padding: 35px 12px;
          color: #a9c1b3;
        }

        .tdm-empty div {
          font-size: 30px;
          margin-bottom: 10px;
        }

        .tdm-empty strong {
          display: block;
          color: #ffffff;
          font-size: 14px;
        }

        .tdm-empty p {
          font-size: 11px;
          margin: 7px 0 0;
        }

        .tdm-draw-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tdm-draw-card {
          padding: 14px;
          border-radius: 10px;
          background: #10251c;
          border: 1px solid #2c4938;
        }

        .tdm-draw-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        }

        .tdm-draw-date-label {
          color: #8ca99a;
          font-size: 9px;
          letter-spacing: 1px;
          font-weight: 800;
        }

        .tdm-draw-top h3 {
          margin: 5px 0 0;
          font-size: 17px;
          font-weight: 850;
        }

        .tdm-status {
          padding: 6px 9px;
          border-radius: 30px;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .tdm-status.upcoming {
          background: #45371c;
          color: #f9d77d;
        }

        .tdm-status.open {
          background: #124b31;
          color: #80f4b5;
        }

        .tdm-status.completed {
          background: #26394b;
          color: #a8d7ff;
        }

        .tdm-draw-info {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px 8px;
          padding: 13px 0;
          border-top: 1px solid #294334;
          border-bottom: 1px solid #294334;
        }

        .tdm-draw-info div {
          min-width: 0;
        }

        .tdm-draw-info span {
          display: block;
          color: #91aa9c;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .tdm-draw-info strong {
          display: block;
          color: #ffffff;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .tdm-draw-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 13px;
        }

        .tdm-edit-button {
          width: 100%;
          min-height: 43px;
          border: 1px solid #39745a;
          border-radius: 8px;
          background: #1b4532;
          color: #9af0bd;
          padding: 11px 14px;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .tdm-edit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tdm-open-button {
          width: 100%;
          background: #d99d32;
          color: #241805;
        }

        .tdm-winner-button {
          width: 100%;
          background: #00c878;
          color: #062318;
        }

        .tdm-completed-label {
          display: block;
          width: 100%;
          text-align: center;
          padding: 12px;
          border-radius: 7px;
          background: #1a3546;
          color: #a8d7ff;
          font-size: 10px;
          font-weight: 900;
        }

        .tdm-security-note {
          padding: 14px;
          border: 1px solid #315341;
          border-radius: 10px;
          background: #142d22;
        }

        .tdm-security-note strong {
          color: #8cf0b8;
          font-size: 12px;
        }

        .tdm-security-note p {
          color: #a5bbae;
          font-size: 11px;
          line-height: 1.7;
          margin: 7px 0 0;
        }

        .tdm-denied {
          max-width: 400px;
          margin: 80px auto;
          padding: 25px;
          text-align: center;
          background: #142b22;
          border: 1px solid #345444;
          border-radius: 13px;
        }

        .tdm-denied-icon {
          width: 42px;
          height: 42px;
          margin: 0 auto 13px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #642b30;
          color: #ffffff;
          font-size: 24px;
          font-weight: 900;
        }

        .tdm-denied h1 {
          font-size: 21px;
        }

        .tdm-denied p {
          color: #b6c9bd;
          font-size: 12px;
          line-height: 1.6;
        }

        .tdm-denied button {
          margin-top: 10px;
          padding: 11px 20px;
          border: 0;
          border-radius: 7px;
          background: #00c878;
          color: #062318;
          font-weight: 900;
        }

        .tdm-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: #000000bb;
          overflow-y: auto;
        }

        .tdm-modal {
          width: 100%;
          max-width: 390px;
          padding: 23px;
          border: 1px solid #3a5c48;
          border-radius: 14px;
          background: #173126;
          text-align: center;
          box-shadow: 0 20px 70px #00000066;
        }

        .tdm-modal-icon {
          width: 45px;
          height: 45px;
          margin: 0 auto 12px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #24573e;
          color: #8df2ba;
          font-size: 23px;
        }

        .tdm-modal h2 {
          font-size: 19px;
          margin: 0 0 10px;
        }

        .tdm-modal p {
          color: #b4c9bc;
          font-size: 12px;
          line-height: 1.6;
        }

        .tdm-modal .tdm-warning-text {
          color: #ffd28b;
        }

        .tdm-modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 20px;
        }

        .tdm-cancel-button {
          min-height: 42px;
          border: 1px solid #557060;
          border-radius: 7px;
          background: transparent;
          color: #ffffff;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .tdm-confirm-button {
          background: #00c878;
          color: #062318;
        }

        /* NEW: Edit Modal Styles */

        .tdm-edit-modal {
          width: 100%;
          max-width: 460px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 20px;
          border: 1px solid #3a5c48;
          border-radius: 14px;
          background: #173126;
          box-shadow: 0 20px 70px #00000066;
        }

        .tdm-edit-modal-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 17px;
        }

        .tdm-edit-modal-heading h2 {
          margin: 7px 0;
          font-size: 20px;
          font-weight: 900;
        }

        .tdm-edit-modal-heading p {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #a9c2b4;
          font-size: 11px;
          margin: 7px 0 0;
        }

        .tdm-edit-close {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border: 1px solid #496655;
          border-radius: 7px;
          background: #203d2e;
          color: #ffffff;
          font-size: 22px;
          cursor: pointer;
        }

        .tdm-edit-close:disabled {
          opacity: 0.5;
        }

        .tdm-edit-info {
          margin-bottom: 15px;
          padding: 11px;
          border: 1px solid #826b36;
          border-radius: 8px;
          background: #3c321c;
          color: #ffdf9a;
          font-size: 11px;
          line-height: 1.7;
        }

        .tdm-edit-form {
          display: grid;
          grid-template-columns: 1fr;
          gap: 13px;
        }

        .tdm-edit-form label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #b8cfc2;
          font-size: 11px;
          font-weight: 750;
        }

        .tdm-edit-form input {
          width: 100%;
          min-height: 45px;
          padding: 10px 12px;
          box-sizing: border-box;
          background: #0e211a;
          color: #ffffff;
          border: 1px solid #345444;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          color-scheme: dark;
        }

        .tdm-edit-form input:focus {
          border-color: #00c878;
          box-shadow: 0 0 0 2px #00c87822;
        }

        .tdm-edit-form input:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          background: #172a20;
        }

        .tdm-edit-modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 9px;
        }

        .tdm-save-button {
          min-height: 43px;
          border: 0;
          border-radius: 7px;
          background: #00c878;
          color: #062318;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .tdm-save-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (min-width: 650px) {
          .tdm-main {
            padding: 35px 24px 65px;
          }

          .tdm-stats {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .tdm-form {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .tdm-primary-button {
            grid-column: 1 / -1;
          }

          .tdm-draw-info {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .tdm-edit-form {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .tdm-edit-modal-actions {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </div>
  );
}
