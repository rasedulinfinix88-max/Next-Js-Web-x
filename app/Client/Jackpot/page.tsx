
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import LotteryHeader from "../../../components/Header/Header";
import LotteryFooter from "../../../components/Footer/Footer";


type JackpotDraw = {
  id: string;
  category: number;
  ticket_price: number;
  prize_amount: number;
  sales_open_at: string;
  sales_close_at: string;
  draw_at: string;
  status: string;
  total_tickets_sold: number;
};

const JACKPOT_CATEGORIES = [
  {
    category: 500,
    prize: 2500000,
    color: "#e5a83b",
    accent: "#f5c76b",
  },
  {
    category: 1000,
    prize: 5000000,
    color: "#38bdf8",
    accent: "#7dd3fc",
  },
  {
    category: 2000,
    prize: 10000000,
    color: "#b78aff",
    accent: "#d0b1ff",
  },
];

export default function JackpotHomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draws, setDraws] = useState<JackpotDraw[]>([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const user = session?.user ?? null;

        if (mounted) {
          setIsAuthenticated(!!user);
        }

        if (user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (mounted && profileData) {
            setProfile(profileData);
          }
        }

        const { data, error: drawError } = await supabase.rpc(
          "jackpot_get_available_draws"
        );

        if (drawError) throw drawError;

        if (mounted) {
          setDraws((data || []) as JackpotDraw[]);
          setError("");
        }
      } catch (err: any) {
        console.error("Jackpot loading error:", err);

        if (mounted) {
          setError(
            err?.message || "Unable to load Jackpot information."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatMoney = (amount: number) =>
    Number(amount || 0).toLocaleString("en-IN");

  const getDraw = (category: number) => {
    return draws
      .filter((draw) => Number(draw.category) === category)
      .sort(
        (a, b) =>
          new Date(a.draw_at).getTime() -
          new Date(b.draw_at).getTime()
      )[0];
  };

  const getCountdown = (target?: string) => {
    if (!target) return null;

    const difference = Math.max(
      0,
      new Date(target).getTime() - now
    );

    const days = Math.floor(
      difference / (1000 * 60 * 60 * 24)
    );

    const hours = Math.floor(
      (difference / (1000 * 60 * 60)) % 24
    );

    const minutes = Math.floor(
      (difference / (1000 * 60)) % 60
    );

    const seconds = Math.floor(
      (difference / 1000) % 60
    );

    return { days, hours, minutes, seconds };
  };

  const getStatus = (draw?: JackpotDraw) => {
    if (!draw) return "Not Scheduled";

    if (draw.status === "open") return "Sales Open";
    if (draw.status === "upcoming") return "Upcoming";
    if (draw.status === "closed") return "Sales Closed";
    if (draw.status === "drawn") return "Winner Selected";
    if (draw.status === "published") return "Result Published";
    if (draw.status === "cancelled") return "Cancelled";

    return draw.status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071510] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#d6a94d] border-t-transparent rounded-full animate-spin" />
        <p className="text-white mt-4 text-xs font-bold tracking-widest">
          LOADING JACKPOT...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071510] text-white pb-20">
      <LotteryHeader
        userProfile={profile}
        initialAuthChecked={true}
        initialIsLoggedIn={isAuthenticated}
      />

      <main className="max-w-5xl mx-auto px-3 pt-5">
        {/* Main Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-[#b58b43]/40 bg-gradient-to-br from-[#183b2c] via-[#10291f] to-[#071510] p-5 mb-6">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#d6a94d]/10 blur-3xl" />

          <div className="relative z-10 text-center">
            <div className="text-[#e9c477] text-xs font-bold tracking-[4px] mb-3">
              WEEKLY GRAND DRAW
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-wide">
              JACKPOT
            </h1>

            <p className="text-[#c6d6cc] text-sm mt-2">
              Choose your ticket category and join the weekly draw.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#d6a94d]/40 bg-black/20 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-[#d6a94d] animate-pulse" />
              <span className="text-[#f2d28c] text-xs font-bold">
                THREE JACKPOT CATEGORIES
              </span>
            </div>
          </div>
        </section>

        {/* Jackpot Heading */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold">
              Choose Your Jackpot
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Select a category to view details
            </p>
          </div>

          <span className="text-[#e9c477] text-xs font-bold">
            WEEKLY
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 mb-4">
            <p className="text-red-300 text-sm text-center">
              {error}
            </p>
          </div>
        )}

        {/* Jackpot Cards */}
        <div className="grid grid-cols-1 gap-4">
          {JACKPOT_CATEGORIES.map((item) => {
            const draw = getDraw(item.category);
            const countdown = getCountdown(draw?.draw_at);
            const isOpen = draw?.status === "open";

            return (
              <section
                key={item.category}
                className="relative overflow-hidden rounded-2xl border bg-[#10231b] shadow-lg"
                style={{ borderColor: `${item.color}55` }}
              >
                <div
                  className="absolute -right-10 -top-12 w-40 h-40 rounded-full blur-3xl opacity-10"
                  style={{ backgroundColor: item.color }}
                />

                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div
                        className="text-xs font-extrabold tracking-[2px]"
                        style={{ color: item.accent }}
                      >
                        JACKPOT CATEGORY
                      </div>

                      <h3 className="text-2xl font-black mt-1">
                        ৳{formatMoney(item.category)}
                      </h3>

                      <p className="text-xs text-gray-400 mt-1">
                        Ticket Price
                      </p>
                    </div>

                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center border-2 text-xl font-black"
                      style={{
                        borderColor: item.color,
                        color: item.accent,
                        backgroundColor: `${item.color}12`,
                      }}
                    >
                      ৳
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-black/25 p-4">
                    <p className="text-xs text-gray-400 font-semibold">
                      TOTAL PRIZE
                    </p>

                    <div
                      className="text-2xl sm:text-3xl font-black mt-1"
                      style={{ color: item.accent }}
                    >
                      ৳{formatMoney(item.prize)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-4">
                    <div>
                      <p className="text-[11px] text-gray-400">
                        DRAW STATUS
                      </p>

                      <p
                        className={`text-xs font-bold mt-1 ${
                          isOpen ? "text-green-400" : "text-yellow-300"
                        }`}
                      >
                        {getStatus(draw)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] text-gray-400">
                        TICKETS SOLD
                      </p>

                      <p className="text-sm font-bold mt-1">
                        {Number(draw?.total_tickets_sold || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {countdown && (
                    <div className="mt-4">
                      <p className="text-[11px] text-gray-400 mb-2">
                        TIME UNTIL DRAW
                      </p>

                      <div className="grid grid-cols-4 gap-2">
                        {[
                          ["DAYS", countdown.days],
                          ["HOURS", countdown.hours],
                          ["MINS", countdown.minutes],
                          ["SECS", countdown.seconds],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-lg bg-black/35 border border-white/5 py-2 text-center"
                          >
                            <div className="text-lg font-black tabular-nums">
                              {String(value).padStart(2, "0")}
                            </div>
                            <div className="text-[9px] text-gray-400 font-bold">
                              {label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      router.push(`/Client/Jackpot/${item.category}/`)
                    }
                    className="w-full mt-4 rounded-xl py-3 font-extrabold text-sm transition active:scale-[0.98]"
                    style={{
                      backgroundColor: item.color,
                      color: "#071510",
                    }}
                  >
                    VIEW JACKPOT DETAILS
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        {/* Information */}
        <section className="mt-6 rounded-xl border border-white/10 bg-[#10231b] p-4">
          <h3 className="text-sm font-bold text-[#e9c477]">
            HOW JACKPOT WORKS
          </h3>

          <ul className="mt-3 space-y-2 text-xs text-gray-300">
            <li>• Choose one of the three Jackpot categories.</li>
            <li>• Check the draw schedule and ticket price.</li>
            <li>• Purchase tickets while sales are open.</li>
            <li>• The Super Admin initiates the winner selection.</li>
            <li>• Published results become visible to users.</li>
          </ul>
        </section>
      </main>

      <LotteryFooter />
    </div>
  );
}
