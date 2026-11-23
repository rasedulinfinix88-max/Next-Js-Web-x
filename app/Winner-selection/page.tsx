
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import LotteryHeader from "../../components/Header/Header";
import LotteryFooter from "../../components/Footer/Footer";

type Winner = {
  ticket_id: string;
  ticket_number: string;
  ticket_price: number;
  prize_amount?: number;
  winner_name_masked: string;
  token: string;
};

type Draw = {
  draw_id: string;
  draw_date: string;
  total_jackpot: number;
  winners: Winner[];
};

type JackpotWinner = {
  ticket_id: string;
  ticket_number: string;
  ticket_price: number;
  prize_amount: number;
  winner_name_masked: string;
  token: string;
};

type JackpotDraw = {
  draw_id: string;
  category: string;
  draw_date: string;
  ticket_price: number;
  total_jackpot: number;
  total_tickets_sold: number;
  published_at: string | null;
  winners: JackpotWinner[];
};

type HistoryTab = "jackpot" | "winner";

export default function WinnerSelectionPage() {
  const router = useRouter();

  const [draws, setDraws] = useState<Draw[]>([]);
  const [jackpotDraws, setJackpotDraws] = useState<JackpotDraw[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>("jackpot");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWinners = useCallback(async () => {
    const startTime = Date.now();

    setLoading(true);
    setError("");

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("winner-list-public", {
          body: {},
        });

      if (functionError) {
        throw new Error(
          functionError.message || "Winner list could not be loaded."
        );
      }

      if (!data?.success || !Array.isArray(data.draws)) {
        throw new Error(
          data?.message || "Invalid winner list response."
        );
      }

      const sortedDraws = [...data.draws]
        .filter((draw: Draw) => Array.isArray(draw.winners))
        .sort(
          (a: Draw, b: Draw) =>
            new Date(b.draw_date).getTime() -
            new Date(a.draw_date).getTime()
        );

      const sortedJackpotDraws: JackpotDraw[] =
        Array.isArray(data.jackpot_draws)
          ? [...data.jackpot_draws]
              .filter(
                (draw: JackpotDraw) =>
                  Array.isArray(draw.winners)
              )
              .sort(
                (a: JackpotDraw, b: JackpotDraw) =>
                  new Date(b.draw_date).getTime() -
                  new Date(a.draw_date).getTime()
              )
          : [];

      setDraws(sortedDraws);
      setJackpotDraws(sortedJackpotDraws);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 3100 - elapsed);

      window.setTimeout(() => {
        setLoading(false);
      }, remaining);
    }
  }, []);

  useEffect(() => {
    loadWinners();
  }, [loadWinners]);

  const verifyTicket = (token: string) => {
    if (!token) return;

    router.push(
      `/verify-ticket/?token=${encodeURIComponent(token)}`
    );
  };

  const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const formatJackpotDate = (date: string) => {
    return new Date(date).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const formatMoney = (
    amount: number | null | undefined
  ) => {
    return `৳${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <main className="winner-page">
      <LotteryHeader />

      {loading ? (
        <div className="winner-loading">
          <div className="loading-animation">
            <svg
              viewBox="0 0 180 160"
              className="loading-svg"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="Loading winner results"
            >
              <g className="loading-trophy">
                <path
                  d="M66 39 H114 V57 C114 76 104 88 90 88 C76 88 66 76 66 57 Z"
                  fill="#ffffff"
                />

                <path
                  d="M66 47 H53 V55 C53 68 59 75 75 77"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="5"
                  strokeLinecap="round"
                />

                <path
                  d="M114 47 H127 V55 C127 68 121 75 105 77"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="5"
                  strokeLinecap="round"
                />

                <path
                  d="M90 88 V104 M74 109 H106 M79 104 H101"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="5"
                  strokeLinecap="round"
                />

                <path
                  d="M90 47 L95 57 L106 59 L98 67 L100 78 L90 72 L80 78 L82 67 L74 59 L85 57 Z"
                  fill="#172019"
                />
              </g>

              <circle
                className="loading-star"
                cx="90"
                cy="14"
                r="3"
                fill="#ffffff"
              />

              <circle
                className="loading-star"
                cx="145"
                cy="70"
                r="2.5"
                fill="#ffffff"
              />

              <circle
                className="loading-star"
                cx="35"
                cy="70"
                r="2.5"
                fill="#ffffff"
              />
            </svg>
          </div>
        </div>
      ) : (
        <div className="winner-container">

          {error ? (
            <div className="error-box">
              <p>{error}</p>
              <button onClick={loadWinners}>
                TRY AGAIN
              </button>
            </div>
          ) : (
            <>
              {/* HISTORY BUTTONS */}

              <div className="history-tabs">
                <button
                  className={`history-tab jackpot-tab ${
                    activeTab === "jackpot" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("jackpot")}
                >
                  <span className="tab-star">★</span>
                  <span>JACKPOT WINNING HISTORY</span>
                  <small>{jackpotDraws.length}</small>
                </button>

                <button
                  className={`history-tab winner-tab ${
                    activeTab === "winner" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("winner")}
                >
                  <span className="tab-star">★</span>
                  <span>WINNER SELECTION HISTORY</span>
                  <small>{draws.length}</small>
                </button>
              </div>

              {/* JACKPOT HISTORY */}

              {activeTab === "jackpot" && (
                <section className="history-content">

                  {jackpotDraws.length === 0 ? (
                    <div className="message-box">
                      No published Jackpot winners available yet.
                    </div>
                  ) : (
                    <div className="history-grid">
                      {jackpotDraws.map((draw) => (
                        <section
                          className="draw-card"
                          key={`jackpot-${draw.draw_id}`}
                        >
                          <div className="draw-header">
                            <div>
                              <span className="draw-label jackpot-label">
                                ★ JACKPOT WINNER
                              </span>

                              <h2>
                                {draw.category || "Jackpot Draw"}
                              </h2>

                              <span className="draw-date">
                                {formatJackpotDate(draw.draw_date)}
                              </span>
                            </div>

                            <div className="prize-pool">
                              <span>JACKPOT PRIZE</span>
                              <strong>
                                {formatMoney(draw.total_jackpot)}
                              </strong>
                            </div>
                          </div>

                          <div className="jackpot-details">
                            <div>
                              <span>TICKET PRICE</span>
                              <strong>
                                {formatMoney(draw.ticket_price)}
                              </strong>
                            </div>

                            <div>
                              <span>TICKETS SOLD</span>
                              <strong>
                                {Number(
                                  draw.total_tickets_sold || 0
                                ).toLocaleString("en-IN")}
                              </strong>
                            </div>
                          </div>

                          <div className="winner-table-header">
                            <span>WINNER</span>
                            <span>TICKET DETAILS</span>
                          </div>

                          {draw.winners.map((winner, index) => (
                            <div
                              className="winner-row"
                              key={winner.ticket_id || index}
                            >
                              <div className="winner-info">
                                <div className="winner-avatar jackpot-avatar">
                                  ★
                                </div>

                                <div className="winner-name">
                                  <strong>
                                    {winner.winner_name_masked}
                                  </strong>
                                  <span>JACKPOT WINNER</span>
                                </div>
                              </div>

                              <div className="ticket-info">
                                <strong>
                                  #{winner.ticket_number}
                                </strong>

                                <span>
                                  Ticket: {formatMoney(winner.ticket_price)}
                                </span>

                                <span className="ticket-id">
                                  Ticket ID: {winner.ticket_id}
                                </span>

                                <span className="jackpot-prize">
                                  Prize: {formatMoney(winner.prize_amount)}
                                </span>
                              </div>

                              <button
                                className="verify-button"
                                disabled={!winner.token}
                                onClick={() =>
                                  verifyTicket(winner.token)
                                }
                              >
                                VERIFY DRAWS
                              </button>
                            </div>
                          ))}

                          <div className="draw-footer">
                            Total Winners: {draw.winners.length}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* EXISTING WINNER SELECTION HISTORY */}

              {activeTab === "winner" && (
                <section className="history-content">

                  {draws.length === 0 ? (
                    <div className="message-box">
                      No confirmed winners available yet.
                    </div>
                  ) : (
                    <div className="history-grid">
                      {draws.map((draw) => (
                        <section
                          className="draw-card"
                          key={draw.draw_id}
                        >
                          <div className="draw-header">
                            <div>
                              <span className="draw-label">
                                COMPLETED DRAW
                              </span>

                              <h2>Winner Draw</h2>

                              <span className="draw-date">
                                {formatDate(draw.draw_date)}
                              </span>
                            </div>

                            <div className="prize-pool">
                              <span>PRIZE POOL</span>
                              <strong>
                                {formatMoney(draw.total_jackpot)}
                              </strong>
                            </div>
                          </div>

                          <div className="winner-table-header">
                            <span>WINNER</span>
                            <span>TICKET DETAILS</span>
                          </div>

                          {draw.winners.map((winner, index) => (
                            <div
                              className="winner-row"
                              key={winner.ticket_id || index}
                            >
                              <div className="winner-info">
                                <div className="winner-avatar">
                                  ★
                                </div>

                                <div className="winner-name">
                                  <strong>
                                    {winner.winner_name_masked}
                                  </strong>
                                  <span>WINNER</span>
                                </div>
                              </div>

                              <div className="ticket-info">
                                <strong>
                                  #{winner.ticket_number}
                                </strong>

                                <span>
                                  Ticket: {formatMoney(winner.ticket_price)}
                                </span>

                                {winner.prize_amount !== undefined && (
                                  <span className="jackpot-prize">
                                    Prize: {formatMoney(winner.prize_amount)}
                                  </span>
                                )}
                              </div>

                              <button
                                className="verify-button"
                                disabled={!winner.token}
                                onClick={() =>
                                  verifyTicket(winner.token)
                                }
                              >
                                VERIFY DRAWS
                              </button>
                            </div>
                          ))}

                          <div className="draw-footer">
                            Total Winners: {draw.winners.length}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      )}

      <LotteryFooter />

      <style jsx>{`
        .winner-page {
          min-height: 100vh;
          background: #0d241e;
          color: #ffffff;
          padding-bottom: 85px;
          font-family: Arial, sans-serif;
        }

        .winner-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 22px 14px 30px;
        }

        /* WHITE WINNER LOADING ANIMATION */

        .winner-loading {
          min-height: 65vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 25px;
          background: #0d241e;
        }

        .loading-animation {
          width: 180px;
          height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-svg {
          width: 180px;
          height: 160px;
          overflow: visible;
        }

        .loading-trophy {
          transform-box: fill-box;
          transform-origin: center;
          animation: trophy-pulse 1.3s ease-in-out infinite alternate;
        }

        .loading-star {
          animation: star-pulse 1s ease-in-out infinite alternate;
        }

        @keyframes trophy-pulse {
          from {
            transform: scale(0.48);
          }
          to {
            transform: scale(0.52);
          }
        }

        @keyframes star-pulse {
          from {
            opacity: 0.35;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        /* HISTORY TABS */

        .history-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 24px;
        }

        .history-tab {
          min-height: 58px;
          padding: 10px 8px;
          border: 1px solid #34483a;
          border-radius: 9px;
          background: #19231d;
          color: #9aafa0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.3px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .history-tab .tab-star {
          font-size: 14px;
        }

        .history-tab small {
          min-width: 19px;
          height: 19px;
          padding: 0 5px;
          border-radius: 20px;
          background: #29382e;
          color: #c4d4c9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
        }

        .jackpot-tab.active {
          background: #3b3020;
          border-color: #b28a3d;
          color: #f5cf70;
        }

        .jackpot-tab.active small {
          background: #665329;
          color: #ffffff;
        }

        .winner-tab.active {
          background: #20372a;
          border-color: #49df91;
          color: #56e69a;
        }

        .winner-tab.active small {
          background: #315b40;
          color: #ffffff;
        }

        .section-heading {
          text-align: center;
          padding: 8px 8px 20px;
        }

        .section-heading > span {
          color: #56e69a;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .jackpot-heading-title > span {
          color: #f5cf70;
        }

        .section-heading h1 {
          font-size: 19px;
          margin: 8px 0 5px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .section-heading p {
          color: #91a99a;
          font-size: 11px;
          margin: 0;
        }

        /* GRID CARDS */

        .history-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }

        .draw-card {
          background: #19231d;
          border: 1px solid #2b3b31;
          border-radius: 12px;
          overflow: hidden;
          min-width: 0;
        }

        .draw-header {
          padding: 17px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          background: #20372a;
          border-bottom: 1px solid #34513d;
        }

        .draw-label {
          font-size: 9px;
          font-weight: 900;
          color: #4cdb91;
          letter-spacing: 1.3px;
        }

        .jackpot-label {
          color: #f5cf70;
        }

        .draw-header h2 {
          font-size: 17px;
          margin: 6px 0 4px;
          overflow-wrap: anywhere;
        }

        .draw-date {
          display: block;
          color: #a9c4b1;
          font-size: 10px;
          margin-top: 5px;
        }

        .prize-pool {
          text-align: right;
          flex-shrink: 0;
        }

        .prize-pool span {
          display: block;
          font-size: 9px;
          color: #a9c4b1;
          font-weight: 800;
        }

        .prize-pool strong {
          display: block;
          color: #56e69a;
          font-size: 16px;
          margin-top: 5px;
        }

        .jackpot-card {
          border-color: #806b35;
        }

        .jackpot-card .draw-header {
          background: linear-gradient(135deg, #3b3020, #263b2c);
          border-bottom-color: #806b35;
        }

        .jackpot-card .prize-pool strong {
          color: #f5cf70;
        }

        .jackpot-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 13px 15px;
          gap: 12px;
          background: #1c2921;
          border-bottom: 1px solid #344338;
        }

        .jackpot-details span {
          display: block;
          font-size: 9px;
          color: #9aab9f;
          font-weight: 800;
        }

        .jackpot-details strong {
          display: block;
          margin-top: 5px;
          font-size: 13px;
          color: #ffffff;
        }

        .winner-table-header {
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 12px 14px;
          color: #829489;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          border-bottom: 1px solid #293a30;
        }

        .winner-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-bottom: 1px solid #29372f;
        }

        .winner-info {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .winner-avatar {
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #315b40;
          color: #71e7a2;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
        }

        .jackpot-avatar {
          background: #665329;
          color: #ffdf80;
        }

        .winner-name {
          min-width: 0;
        }

        .winner-name strong {
          display: block;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .winner-name span {
          display: block;
          color: #4bd58c;
          font-size: 9px;
          margin-top: 4px;
          font-weight: 800;
        }

        .ticket-info {
          min-width: 0;
        }

        .ticket-info strong {
          display: block;
          color: #ffffff;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .ticket-info span {
          display: block;
          color: #9aa99f;
          font-size: 10px;
          margin-top: 5px;
          overflow-wrap: anywhere;
        }

        .ticket-info .ticket-id {
          color: #b6c7bb;
          font-size: 9px;
        }

        .ticket-info .jackpot-prize {
          color: #f5cf70;
          font-weight: 900;
        }

        .verify-button {
          grid-column: 1 / -1;
          width: 100%;
          padding: 11px;
          border: 0;
          border-radius: 6px;
          background: #24a95e;
          color: #ffffff;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.7px;
          cursor: pointer;
        }

        .verify-button:disabled {
          background: #526158;
          cursor: not-allowed;
        }

        .draw-footer {
          padding: 12px 14px;
          color: #8fa397;
          font-size: 11px;
          text-align: right;
        }

        .message-box,
        .error-box {
          background: #19231d;
          border: 1px solid #2b3b31;
          padding: 22px;
          border-radius: 10px;
          text-align: center;
          color: #c0cec5;
          font-size: 13px;
        }

        .error-box {
          color: #ff9292;
        }

        .error-box button {
          margin-top: 10px;
          padding: 9px 16px;
          background: #315b40;
          color: white;
          border: 0;
          border-radius: 6px;
        }

        @media (min-width: 600px) {
          .winner-container {
            padding: 30px 22px;
          }

          .history-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .history-tab {
            min-height: 64px;
            font-size: 12px;
          }

          .winner-row {
            grid-template-columns: 1fr 1fr 125px;
          }

          .verify-button {
            grid-column: auto;
          }
        }

        @media (max-width: 380px) {
          .history-tabs {
            gap: 7px;
          }

          .history-tab {
            font-size: 9px;
            gap: 4px;
            padding: 9px 5px;
          }

          .history-tab .tab-star {
            display: none;
          }

          .draw-header {
            padding: 14px 11px;
          }

          .draw-header h2 {
            font-size: 15px;
          }

          .prize-pool strong {
            font-size: 14px;
          }

          .winner-row {
            padding: 12px 10px;
            gap: 8px;
          }
        }
      `}</style>
    </main>
  );
}
