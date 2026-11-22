
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

type Draw = {
  id: string;
  category: string;
  ticket_price: number;
  prize_amount: number;
  sales_open_at: string;
  sales_close_at: string;
  draw_at: string;
  status: string;
  total_tickets_sold: number;
  created_at: string;
};

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatPrize(value: number) {
  return Number(value).toLocaleString("en-BD");
}

export default function JackpotManagementPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loadingDraws, setLoadingDraws] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [category, setCategory] = useState("500");
  const [salesOpenAt, setSalesOpenAt] = useState("");
  const [salesCloseAt, setSalesCloseAt] = useState("");
  const [drawAt, setDrawAt] = useState("");
  const [editingDrawId, setEditingDrawId] = useState("");

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
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
    }

    verifyAdmin();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      router.replace(
        "/admin-panel-rakib-aiman-tushar/Admin-login/"
      );
    } catch {
      setLoggingOut(false);
    }
  }

  async function callApi(
    action: string,
    params: Record<string, string> = {}
  ) {
    const supabase = createClient();

    const { data: sessionData } =
      await supabase.auth.getSession();

    if (!sessionData.session?.access_token) {
      throw new Error(
        "Admin Login session পাওয়া যায়নি। আবার Login করুন।"
      );
    }

    const { data, error: functionError } =
      await supabase.functions.invoke(
        "jackpot-manager",
        {
          body: {
            action,
            ...params
          }
        }
      );

    if (functionError) {
      let details = functionError.message;

      const context = (
        functionError as { context?: unknown }
      ).context;

      if (context instanceof Response) {
        const body = await context.clone().text();

        details =
          `HTTP Status: ${context.status}\n\n` +
          `Backend Response:\n${body || functionError.message}`;
      }

      throw new Error(details);
    }

    if (data?.success === false) {
      throw new Error(
        data.message || "Backend operation ব্যর্থ হয়েছে।"
      );
    }

    return data;
  }

  async function loadDraws() {
    setLoadingDraws(true);
    setError("");

    try {
      const data = await callApi("admin_list_draws");
      setDraws(Array.isArray(data?.draws) ? data.draws : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Draw List পাওয়া যায়নি।"
      );
    } finally {
      setLoadingDraws(false);
    }
  }

  useEffect(() => {
    if (adminAllowed) {
      loadDraws();
    }
  }, [adminAllowed]);

  function validateSchedule() {
    if (!salesOpenAt || !salesCloseAt || !drawAt) {
      throw new Error("তিনটি তারিখ ও সময় পূরণ করুন।");
    }

    const open = new Date(salesOpenAt).getTime();
    const close = new Date(salesCloseAt).getTime();
    const draw = new Date(drawAt).getTime();

    if (
      !Number.isFinite(open) ||
      !Number.isFinite(close) ||
      !Number.isFinite(draw) ||
      open >= close ||
      close > draw
    ) {
      throw new Error(
        "সময় সঠিক নয়। Sales Start < Sales End এবং Sales End ≤ Draw Time হতে হবে।"
      );
    }
  }

  async function saveDraw() {
    setBusyAction("save");
    setError("");
    setNotice("");

    try {
      validateSchedule();

      const params = {
        p_sales_open_at: new Date(salesOpenAt).toISOString(),
        p_sales_close_at: new Date(salesCloseAt).toISOString(),
        p_draw_at: new Date(drawAt).toISOString()
      };

      if (editingDrawId) {
        await callApi("admin_update_draw", {
          p_draw_id: editingDrawId,
          ...params
        });

        setNotice("Draw Schedule সফলভাবে Update হয়েছে।");
      } else {
        await callApi("admin_create_draw", {
          p_category: category,
          ...params
        });

        setNotice("নতুন Jackpot Draw তৈরি হয়েছে।");
      }

      setEditingDrawId("");
      await loadDraws();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Draw Save করা যায়নি।"
      );
    } finally {
      setBusyAction("");
    }
  }

  function editSchedule(draw: Draw) {
    setEditingDrawId(draw.id);
    setCategory(String(draw.category));
    setSalesOpenAt(toLocalDateTime(draw.sales_open_at));
    setSalesCloseAt(toLocalDateTime(draw.sales_close_at));
    setDrawAt(toLocalDateTime(draw.draw_at));
    setError("");
    setNotice("");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function cancelEdit() {
    setEditingDrawId("");
    setSalesOpenAt("");
    setSalesCloseAt("");
    setDrawAt("");
    setError("");
  }

  async function drawAction(
    drawId: string,
    action: string,
    label: string
  ) {
    setBusyAction(drawId + action);
    setError("");
    setNotice("");

    try {
      await callApi(action, {
        p_draw_id: drawId
      });

      setNotice(label + " সফল হয়েছে।");
      await loadDraws();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Action সম্পন্ন হয়নি।"
      );
    } finally {
      setBusyAction("");
    }
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
              Jackpot Management
            </p>
          </div>

          <AdminMenu
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div>
          <h2 className="text-2xl font-bold text-green-400">
            🎰 Jackpot Dashboard
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Manage Jackpot Draws, Sales Schedule and Results.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/30 p-4">
            <p className="font-semibold text-red-400">
              Error
            </p>
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-red-300">
              {error}
            </pre>
          </div>
        )}

        {notice && (
          <div className="rounded-xl border border-green-800 bg-green-950/20 p-4 text-sm text-green-300">
            {notice}
          </div>
        )}

        <div className="rounded-2xl border border-[#24543b] bg-[#10251a] p-5">
          <h3 className="text-lg font-bold text-green-400">
            {editingDrawId ? "Update Draw Schedule" : "Create New Jackpot Draw"}
          </h3>

          {!editingDrawId && (
            <div className="mt-5">
              <label className="mb-2 block text-sm text-gray-300">
                Ticket Category
              </label>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#356348] bg-[#07110d] p-3 text-white"
              >
                <option value="500">
                  ৳500 Ticket — ৳25,00,000 Prize
                </option>
                <option value="1000">
                  ৳1,000 Ticket — ৳50,00,000 Prize
                </option>
                <option value="2000">
                  ৳2,000 Ticket — ৳1,00,00,000 Prize
                </option>
              </select>
            </div>
          )}

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Sales Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={salesOpenAt}
                onChange={(e) => setSalesOpenAt(e.target.value)}
                className="w-full rounded-lg border border-[#356348] bg-[#07110d] p-3 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Sales End Date & Time
              </label>
              <input
                type="datetime-local"
                value={salesCloseAt}
                onChange={(e) => setSalesCloseAt(e.target.value)}
                className="w-full rounded-lg border border-[#356348] bg-[#07110d] p-3 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Draw Date & Time
              </label>
              <input
                type="datetime-local"
                value={drawAt}
                onChange={(e) => setDrawAt(e.target.value)}
                className="w-full rounded-lg border border-[#356348] bg-[#07110d] p-3 text-white"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={saveDraw}
            disabled={!!busyAction}
            className="mt-6 w-full rounded-lg bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {busyAction === "save"
              ? "Saving..."
              : editingDrawId
                ? "Update Draw Schedule"
                : "Create Jackpot Draw"}
          </button>

          {editingDrawId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="mt-3 w-full rounded-lg border border-gray-600 px-4 py-3 font-semibold text-gray-300"
            >
              Cancel Editing
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-[#24543b] bg-[#10251a] p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-green-400">
              Jackpot Draw List
            </h3>

            <button
              type="button"
              onClick={loadDraws}
              disabled={loadingDraws || !!busyAction}
              className="rounded-lg border border-green-700 px-3 py-2 text-sm text-green-300 disabled:opacity-50"
            >
              {loadingDraws ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadingDraws && (
            <p className="mt-5 text-sm text-gray-400">
              Loading Jackpot Draws...
            </p>
          )}

          {!loadingDraws && draws.length === 0 && (
            <p className="mt-5 rounded-lg bg-[#07110d] p-4 text-sm text-gray-400">
              এখনো কোনো Jackpot Draw তৈরি করা হয়নি।
            </p>
          )}

          <div className="mt-5 space-y-4">
            {draws.map((draw) => {
              const busy = busyAction.startsWith(draw.id);

              return (
                <div
                  key={draw.id}
                  className="rounded-xl border border-[#356348] bg-[#07110d] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-white">
                      ৳{Number(draw.ticket_price).toLocaleString("en-BD")} Jackpot
                    </h4>

                    <span className="rounded-full bg-[#173b29] px-3 py-1 text-xs text-green-300">
                      {draw.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-300">
                    <p>
                      Prize: ৳{formatPrize(draw.prize_amount)}
                    </p>
                    <p>
                      Tickets Sold: {formatPrize(draw.total_tickets_sold)}
                    </p>
                    <p>
                      Sales Start: {formatDate(draw.sales_open_at)}
                    </p>
                    <p>
                      Sales End: {formatDate(draw.sales_close_at)}
                    </p>
                    <p>
                      Draw Time: {formatDate(draw.draw_at)}
                    </p>
                    <p className="break-all text-xs text-gray-500">
                      Draw ID: {draw.id}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => editSchedule(draw)}
                      disabled={busy || !!busyAction}
                      className="rounded-lg border border-blue-700 px-3 py-3 text-xs font-semibold text-blue-300 disabled:opacity-50"
                    >
                      Edit Schedule
                    </button>

                    {draw.status === "upcoming" && (
                      <button
                        type="button"
                        onClick={() =>
                          drawAction(
                            draw.id,
                            "admin_open_draw",
                            "Sales Open"
                          )
                        }
                        disabled={busy || !!busyAction}
                        className="rounded-lg bg-green-700 px-3 py-3 text-xs font-bold disabled:opacity-50"
                      >
                        {busyAction === draw.id + "admin_open_draw"
                          ? "Opening..."
                          : "Open Sales"}
                      </button>
                    )}

                    {draw.status === "open" && (
                      <button
                        type="button"
                        onClick={() =>
                          drawAction(
                            draw.id,
                            "admin_close_draw",
                            "Sales Close"
                          )
                        }
                        disabled={busy || !!busyAction}
                        className="rounded-lg bg-orange-700 px-3 py-3 text-xs font-bold disabled:opacity-50"
                      >
                        {busyAction === draw.id + "admin_close_draw"
                          ? "Closing..."
                          : "Close Sales"}
                      </button>
                    )}

                    {draw.status === "closed" && (
                      <button
                        type="button"
                        onClick={() =>
                          drawAction(
                            draw.id,
                            "admin_select_random_winner",
                            "Random Winner Selection"
                          )
                        }
                        disabled={busy || !!busyAction}
                        className="rounded-lg bg-yellow-600 px-3 py-3 text-xs font-bold text-black disabled:opacity-50"
                      >
                        {busyAction === draw.id + "admin_select_random_winner"
                          ? "Selecting..."
                          : "Select Random Winner"}
                      </button>
                    )}

                    {draw.status === "drawn" && (
                      <button
                        type="button"
                        onClick={() =>
                          drawAction(
                            draw.id,
                            "admin_publish_result",
                            "Publish Result"
                          )
                        }
                        disabled={busy || !!busyAction}
                        className="rounded-lg bg-blue-600 px-3 py-3 text-xs font-bold disabled:opacity-50"
                      >
                        {busyAction === draw.id + "admin_publish_result"
                          ? "Publishing..."
                          : "Publish Result"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
