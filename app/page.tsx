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

  // Jackpot Slider
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

  // Countdown Timer
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const target = new Date();

      target.setHours(0, 30, 0, 0);

      if (now.getTime() > target.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diff = target.getTime() - now.getTime();

      const d = Math.floor(
        diff / (1000 * 60 * 60 * 24)
      );
      const h = Math.floor(
        (diff / (1000 * 60 * 60)) % 24
      );
      const m = Math.floor(
        (diff / 1000 / 60) % 60
      );
      const s = Math.floor(
        (diff / 1000) % 60
      );

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

  // Draw Date Formatter
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

  // Lottery Card Titles
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

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d241e] flex flex-col items-center justify-center">
        <svg
          className="w-12 h-12 text-white animate-spin"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 5v2m0 4v2m0 4v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"
          />
        </svg>

        <p className="text-white mt-4 font-bold tracking-widest animate-pulse text-[11px]">
          LOADING...
        </p>
      </div>
    );
  }

  return (
    <div className="lottery-page-wrapper pb-20 bg-[#0d241e] min-h-screen">
      <LotteryHeader
        userProfile={profile}
        initialAuthChecked={true}
        initialIsLoggedIn={isAuthenticated}
      />

      <div className="lottery-overlay">
        <main className="lottery-main pt-0 mt-0">

          {/* Jackpot Slider */}
          <div
            className="jackpot-slider-wrapper"
            style={{
              backgroundImage:
                "url(https://i.ibb.co.com/6J70LMrp/file-000000002204821192cb3561d5e7a1d3.png)",
            }}
          >
            <div className="jackpot-overlay"></div>

            <div
              className="jackpot-track"
              style={{
                transform: `translateX(-${activeJackpot * 100}%)`,
              }}
            >
              {jackpotAmounts.map((amount, index) => (
                <div key={index} className="jackpot-slide">
                  <div className="jackpot-title">
                    TODAY'S JACKPOT
                  </div>

                  <div className="jackpot-amount">
                    ৳ {amount.toLocaleString()}
                  </div>

                  <div className="timer-container">
                    <div className="timer-box">
                      <span>{timeLeft.hours}</span>
                      <span>HOURS</span>
                    </div>

                    <div className="timer-box">
                      <span>{timeLeft.minutes}</span>
                      <span>MINS</span>
                    </div>

                    <div className="timer-box">
                      <span>{timeLeft.seconds}</span>
                      <span>SECS</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="jackpot-dots">
              {jackpotAmounts.map((_, index) => (
                <div
                  key={index}
                  className={`jackpot-dot ${
                    activeJackpot === index ? "active" : ""
                  }`}
                  onClick={() => setActiveJackpot(index)}
                />
              ))}
            </div>
          </div>

          {/* Dynamic Lottery Draw Cards */}
          <div className="mt-4">
            <div className="ticket-list-container">

              {drawError && (
                <div className="lotto-card">
                  <p className="text-white text-center p-4">
                    {drawError}
                  </p>
                </div>
              )}

              {!drawError && draws.length === 0 && (
                <div className="lotto-card">
                  <p className="text-white text-center p-4">
                    No lottery draws are currently available.
                  </p>
                </div>
              )}

              {draws.map((draw) => {
                const tier = getDrawTitle(
                  Number(draw.ticket_price)
                );

                const prize =
                  Number(draw.prize_amount) ||
                  Number(draw.total_jackpot) ||
                  0;

                const isOpen = draw.status === "open";

                return (
                  <div key={draw.id} className="lotto-card">

                    {/* Card Header */}
                    <div className="lotto-card-header">
                      <div
                        className={`lotto-card-title ${tier.color}`}
                      >
                        {tier.title}{" "}
                        <span
                          style={{
                            color:
                              tier.color === "orange"
                                ? "#16a34a"
                                : "#f97316",
                          }}
                        >
                          {tier.titleSpan}
                        </span>
                      </div>

                      <div className="lotto-card-date">
                        <span>
                          {formatDrawDate(draw.draw_date)}
                        </span>

                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                    </div>

                    {/* Draw Information */}
                    <div className="px-3 py-2 text-white text-sm">
                      <div className="flex justify-between mb-2">
                        <span>Prize Amount</span>
                        <strong>
                          ৳ {prize.toLocaleString()}
                        </strong>
                      </div>

                      <div className="flex justify-between mb-2">
                        <span>Ticket Price</span>
                        <strong>
                          ৳ {Number(draw.ticket_price).toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="lotto-card-actions">
                      <button
                        className="lotto-btn secondary"
                        onClick={() =>
                          router.push("/Winner-selection/")
                        }
                      >
                        Draw History
                      </button>

                      <button
                        className="lotto-btn primary"
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
                      >
                        {isOpen
                          ? `Buy ৳${Number(draw.ticket_price).toLocaleString()}`
                          : "Coming Soon"}
                      </button>
                    </div>

                    {/* Next Draw Timer */}
                    <div className="lotto-timer-bar">
                      <div className="lotto-timer-label">
                        Next
                        <br />
                        Draw
                      </div>

                      <div className="lotto-timer-boxes">
                        <div className="lotto-t-box">
                          <span className="t-val">
                            {timeLeft.days}
                          </span>
                          <span className="t-lbl">Days</span>
                        </div>

                        <div className="lotto-t-box">
                          <span className="t-val">
                            {timeLeft.hours}
                          </span>
                          <span className="t-lbl">Hours</span>
                        </div>

                        <div className="lotto-t-box">
                          <span className="t-val">
                            {timeLeft.minutes}
                          </span>
                          <span className="t-lbl">Mins</span>
                        </div>

                        <div className="lotto-t-box">
                          <span className="t-val">
                            {timeLeft.seconds}
                          </span>
                          <span className="t-lbl">Secs</span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}

            </div>
          </div>

        </main>
      </div>

      <LotteryFooter />
    </div>
  );
}
