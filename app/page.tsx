
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";
import LotteryHeader from "../components/Header/Header";
import LotteryFooter from "../components/Footer/Footer";
import "./lottery.css";

type TicketDraw = {
  id: string;
  draw_date: string;
  status: string;
  ticket_price: number;
  prize_amount: number;
  total_jackpot: number;
  total_tickets_sold: number;
};

export default function LotteryHomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draws, setDraws] = useState<TicketDraw[]>([]);
  const [drawError, setDrawError] = useState("");

  const [timeLeft, setTimeLeft] = useState({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  });

  const [currentDate, setCurrentDate] = useState("");

  const jackpotAmounts = [20000, 50000, 100000, 200000];
  const [activeJackpot, setActiveJackpot] = useState(0);

  // Fetch Session, Profile and Available Draws
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const user = session?.user ?? null;

        if (isMounted) {
          setIsAuthenticated(!!user);
          setProfile(null);
        }

        if (user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (isMounted && profileData) {
            setProfile(profileData);
          }
        }

        const { data: drawData, error: drawFetchError } =
          await supabase.rpc("ticket_available_draws");

        if (drawFetchError) {
          throw drawFetchError;
        }

        if (isMounted) {
          setDraws((drawData || []) as TicketDraw[]);
          setDrawError("");
        }
      } catch (error: any) {
        console.error("Error fetching lottery data:", error);

        if (isMounted) {
          setDrawError(
            error?.message || "Unable to load available draws."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Existing Jackpot banner slider logic
  useEffect(() => {
    const sliderInterval = setInterval(() => {
      setActiveJackpot(
        (prev) => (prev + 1) % jackpotAmounts.length
      );
    }, 3000);

    return () => clearInterval(sliderInterval);
  }, [jackpotAmounts.length]);

  // Current Date
  useEffect(() => {
    const d = new Date();

    const formattedDate = d
      .toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
      .toUpperCase()
      .replace(",", "");

    setCurrentDate(formattedDate);
  }, []);

  // Existing daily countdown logic
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const target = new Date();

      target.setHours(0, 30, 0, 0);

      if (now.getTime() > target.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diff = target.getTime() - now.getTime();

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setTimeLeft({
        days: d.toString().padStart(2, "0"),
        hours: h.toString().padStart(2, "0"),
        minutes: m.toString().padStart(2, "0"),
        seconds: s.toString().padStart(2, "0"),
      });
    };

    updateTimer();

    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, []);

  // Existing Draw Date Formatter
  const formatDrawDate = (date: string) => {
    if (!date) return currentDate;

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate
      .toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
      .toUpperCase()
      .replace(",", "");
  };

  // Existing Lottery Card Titles
  const getDrawTitle = (price: number) => {
    const titles: Record<
      number,
      { title: string; titleSpan: string; color: string }
    > = {
      20: {
        title: "LOTTO",
        titleSpan: "BD",
        color: "orange",
      },
      50: {
        title: "MEGA",
        titleSpan: "BD I",
        color: "green",
      },
      100: {
        title: "DHAKA",
        titleSpan: "MEGA II",
        color: "orange",
      },
      200: {
        title: "DHAKA",
        titleSpan: "MEGA I",
        color: "green",
      },
    };

    return (
      titles[price] || {
        title: "LOTTERY",
        titleSpan: "DRAW",
        color: "green",
      }
    );
  };

  const formatMoney = (amount: number) =>
    Number(amount || 0).toLocaleString("en-IN");

  const getStatus = (status: string) => {
    if (status === "open") return "Sales Open";
    if (status === "upcoming") return "Upcoming";
    if (status === "closed") return "Sales Closed";
    if (status === "drawn") return "Winner Selected";
    if (status === "published") return "Result Published";
    if (status === "cancelled") return "Cancelled";
    return status || "Not Scheduled";
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#071510] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#184f35] border-t-transparent rounded-full animate-spin" />
        <p className="text-white mt-4 text-xs font-bold tracking-widest">
          LOADING LOTTERY...
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
        <section className="relative overflow-hidden rounded-2xl border border-[#184f35]/40 bg-gradient-to-br from-[#183b2c] via-[#10291f] to-[#071510] p-5 mb-6">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#184f35]/10 blur-3xl" />
          <div className="absolute -left-12 -bottom-16 w-40 h-40 rounded-full bg-[#184f35]/10 blur-3xl" />

          <div className="relative z-10 text-center">
            <div className="text-white text-xs font-bold tracking-[4px] mb-3">
              DAILY GRAND DRAW
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-wide">
              LOTTERY
            </h1>

            <p className="text-[#c6d6cc] text-sm mt-2">
              Choose your ticket and join the next exciting draw.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#184f35]/40 bg-black/20 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-[#184f35] animate-pulse" />
              <span className="text-white text-xs font-bold">
                TODAY'S JACKPOT
              </span>
            </div>

            <div className="mt-4 text-3xl sm:text-4xl font-black text-white tabular-nums">
              ৳{formatMoney(jackpotAmounts[activeJackpot])}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {[
                ["HOURS", timeLeft.hours],
                ["MINS", timeLeft.minutes],
                ["SECS", timeLeft.seconds],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg bg-black/35 border border-white/10 py-2 text-center"
                >
                  <div className="text-xl font-black tabular-nums">
                    {value}
                  </div>
                  <div className="text-[9px] text-gray-400 font-bold">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 mt-4">
              {jackpotAmounts.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Show jackpot slide ${index + 1}`}
                  onClick={() => setActiveJackpot(index)}
                  className={`h-2 rounded-full transition-all ${
                    activeJackpot === index
                      ? "w-6 bg-[#184f35]"
                      : "w-2 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Lottery Heading */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold">
              Available Lottery Draws
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Select a draw to view details or buy tickets
            </p>
          </div>

          <span className="text-white text-xs font-bold">
            DAILY
          </span>
        </div>

        {/* Lottery Error Message */}
        {drawError && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 mb-4">
            <p className="text-red-300 text-sm text-center">
              {drawError}
            </p>
          </div>
        )}

        {/* Lottery Draw Cards */}
        <div className="grid grid-cols-1 gap-4">
          {!drawError && draws.length === 0 && (
            <section className="rounded-2xl border border-[#184f35]/30 bg-[#10231b] p-5 text-center shadow-lg">
              <p className="text-gray-300 text-sm">
                No lottery draws are currently available.
              </p>
            </section>
          )}

          {draws.map((draw) => {
            const tier = getDrawTitle(Number(draw.ticket_price));

            const prize =
              Number(draw.prize_amount) ||
              Number(draw.total_jackpot) ||
              0;

            const isOpen = draw.status === "open";

            return (
              <section
                key={draw.id}
                className="relative overflow-hidden rounded-2xl border border-[#184f35]/35 bg-[#10231b] shadow-lg"
              >
                <div className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-[#184f35]/10 blur-3xl" />

                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-extrabold tracking-[2px] text-white">
                        LOTTERY CATEGORY
                      </div>

                      <h3 className="text-2xl font-black mt-1">
                        {tier.title}{" "}
                        <span className="text-white">
                          {tier.titleSpan}
                        </span>
                      </h3>

                      <p className="text-xs text-gray-400 mt-1">
                        Draw Date: {formatDrawDate(draw.draw_date)}
                      </p>
                    </div>

                    <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-[#184f35] text-xl font-black text-white bg-[#184f35]/10">
                      ৳
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-black/25 p-4">
                    <p className="text-xs text-gray-400 font-semibold">
                      TOTAL PRIZE
                    </p>

                    <div className="text-2xl sm:text-3xl font-black mt-1 text-white">
                      ৳{formatMoney(prize)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl bg-black/25 p-3">
                      <p className="text-[11px] text-gray-400">
                        TICKET PRICE
                      </p>
                      <p className="text-sm font-bold mt-1">
                        ৳{formatMoney(Number(draw.ticket_price))}
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/25 p-3">
                      <p className="text-[11px] text-gray-400">
                        TICKETS SOLD
                      </p>
                      <p className="text-sm font-bold mt-1">
                        {formatMoney(Number(draw.total_tickets_sold || 0))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-4">
                    <div>
                      <p className="text-[11px] text-gray-400">
                        DRAW STATUS
                      </p>
                      <p
                        className={`text-xs font-bold mt-1 ${
                          isOpen ? "text-[#184f35]" : "text-white"
                        }`}
                      >
                        {getStatus(draw.status)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] text-gray-400">
                        DRAW DATE
                      </p>
                      <p className="text-sm font-bold mt-1">
                        {formatDrawDate(draw.draw_date)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] text-gray-400 mb-2">
                      NEXT DRAW COUNTDOWN
                    </p>

                    <div className="grid grid-cols-4 gap-2">
                      {[
                        ["DAYS", timeLeft.days],
                        ["HOURS", timeLeft.hours],
                        ["MINS", timeLeft.minutes],
                        ["SECS", timeLeft.seconds],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-lg bg-black/35 border border-white/5 py-2 text-center"
                        >
                          <div className="text-lg font-black tabular-nums">
                            {value}
                          </div>
                          <div className="text-[9px] text-gray-400 font-bold">
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Draw History */}
                  <button
                    type="button"
                    onClick={() => router.push("/Winner-selection/")}
                    className="w-full mt-4 rounded-xl border border-[#184f35]/50 bg-black/20 py-3 text-white font-extrabold text-sm transition active:scale-[0.98]"
                  >
                    DRAW HISTORY
                  </button>

                  {/* Ticket Purchase */}
                  <button
                    type="button"
                    disabled={!isOpen}
                    style={
                      !isOpen
                        ? {
                            opacity: 0.55,
                            cursor: "not-allowed",
                          }
                        : undefined
                    }
                    onClick={() => {
                      if (!isOpen) return;

                      if (!isAuthenticated) {
                        router.push("/Client/Login/");
                        return;
                      }

                      router.push(
                        `/Client/Ticket-Buy?draw_id=${encodeURIComponent(
                          draw.id
                        )}`
                      );
                    }}
                    className="w-full mt-2 rounded-xl bg-[#184f35] text-white py-3 font-extrabold text-sm transition active:scale-[0.98]"
                  >
                    {isOpen
                      ? `BUY TICKET ৳${formatMoney(Number(draw.ticket_price))}`
                      : "COMING SOON"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        {/* Information Section */}
        <section className="mt-6 rounded-xl border border-white/10 bg-[#10231b] p-4">
          <h3 className="text-sm font-bold text-white">
            HOW LOTTERY WORKS
          </h3>

          <ul className="mt-3 space-y-2 text-xs text-gray-300">
            <li>• Choose one of the available Lottery draws.</li>
            <li>• Check the draw date, ticket price and prize amount.</li>
            <li>• Purchase tickets while sales are open.</li>
            <li>• View previous results from Draw History.</li>
          </ul>
        </section>
      </main>

      <LotteryFooter />
    </div>
  );
}
