
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

export default function WinnerSelectionPage() {
  const router = useRouter();

  const [draws, setDraws] = useState<Draw[]>([]);
  const [jackpotDraws, setJackpotDraws] = useState<JackpotDraw[]>([]);
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

      // Existing Winner History
      const sortedDraws = [...data.draws]
        .filter((draw: Draw) => Array.isArray(draw.winners))
        .sort(
          (a: Draw, b: Draw) =>
            new Date(b.draw_date).getTime() -
            new Date(a.draw_date).getTime()
        );

      // New Jackpot Winning History
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
            >
              <circle
                cx="90"
                cy="68"
                r="48"
                fill="none"
                stroke="#294a36"
                strokeWidth="6"
              />

              <circle
                className="loading-ring"
                cx="90"
                cy="68"
                r="48"
                fill="none"
                stroke="#49df91"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="75 227"
              />

              <path
                className="trophy-icon"
                d="M65 37 H115 V56 C115 76 105 89 90 89 C75 89 65 76 65 56 Z"
                fill="#f5c95c"
              />

              <path
                d="M65 45 H52 V53 C52 68 60 74 74 75 M115 45 H128 V53 C128 68 120 74 106 75"
                fill="none"
                stroke="#f5c95c"
                strokeWidth="6"
                strokeLinecap="round"
              />

              <path
                d="M90 89 V105 M73 109 H107 M78 105 H102"
                stroke="#f5c95c"
                strokeWidth="6"
                strokeLinecap="round"
              />

              <path
                d="M90 45 L95 55 L106 57 L98 65 L100 76 L90 70 L80 76 L82 65 L74 57 L85 55 Z"
                fill="#ffffff"
              />

              <text
                x="90"
                y="139"
                fill="#49df91"
                fontSize="11"
                textAnchor="middle"
                fontWeight="bold"
                letterSpacing="1.5"
              >
                WINNER LOADING
              </text>
            </svg>
          </div>

          <div className="loading-progress">
            <div className="loading-progress-fill" />
          </div>

          <p className="loading-message">
            Preparing Winner Results...
          </p>
        </div>
      ) : (
        <div className="winner-container">

          {error && (
            <div className="error-box">
              <p>{error}</p>
              <button onClick={loadWinners}>
                TRY AGAIN
              </button>
            </div>
          )}

          {!error && (
            <>
              {/* JACKPOT WINNING HISTORY */}

              <div className="history-section-title">
                <span>★ JACKPOT</span>
                <h1>JACKPOT WINNING HISTORY</h1>
                <p>Official Published Jackpot Winners</p>
              </div>

              {jackpotDraws.length === 0 ? (
                <div className="message-box jackpot-empty">
                  No published Jackpot winners available yet.
                </div>
              ) : (
                jackpotDraws.map((draw) => (
                  <section
                    className="draw-card jackpot-card"
                    key={`jackpot-${draw.draw_id}`}
                  >
                    <div className="jackpot-heading">
                      <div>
                        <span className="jackpot-label">
                          ★ JACKPOT WINNER
                        </span>
                        <h2>
                          {draw.category || "Jackpot Draw"}
                        </h2>
                        <p>
                          {formatJackpotDate(draw.draw_date)}
                        </p>
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
                        className="winner-row jackpot-winner-row"
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
                      </div>
                    ))}

                    <div className="draw-footer">
                      Total Winners: {draw.winners.length}
                    </div>
                  </section>
                ))
              )}

              {/* EXISTING WINNER HISTORY - PRESERVED */}

              <div className="history-section-title old-history-title">
                <span>★ WINNER RESULTS</span>
                <h1>WINNER SELECTION HISTORY</h1>
                <p>Previous Draw Results</p>
              </div>

              {draws.length === 0 ? (
                <div className="message-box">
                  No confirmed winners available yet.
                </div>
              ) : (
                draws.map((draw) => (
                  <section
                    className="draw-card"
                    key={draw.draw_id}
                  >
                    <div className="draw-header">
                      <div>
                        <span className="draw-label">
                          COMPLETED DRAW
                        </span>
                        <h2>{formatDate(draw.draw_date)}</h2>
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
                ))
              )}
            </>
          )}
        </div>
      )}

      <LotteryFooter />

      <style jsx>{`
        .winner-page {
          min-height: 100vh;
          background: #101512;
          color: #ffffff;
          padding-bottom: 85px;
          font-family: Arial, sans-serif;
        }

        .winner-container {
          max-width: 850px;
          margin: 0 auto;
          padding: 22px 14px 30px;
        }

        .winner-loading {
          min-height: 65vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 25px;
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

        .loading-ring {
          transform-origin: 90px 68px;
          animation: rotate-ring 1s linear infinite;
        }

        .trophy-icon {
          transform-origin: 90px 68px;
          animation: trophy-pulse 1s ease-in-out infinite alternate;
        }

        .loading-progress {
          width: 190px;
          height: 5px;
          background: #26392e;
          border-radius: 20px;
          overflow: hidden;
          margin-top: 15px;
        }

        .loading-progress-fill {
          width: 0%;
          height: 100%;
          background: #49df91;
          border-radius: 20px;
          animation: progress-fill 3.1s linear forwards;
        }

        .loading-message {
          margin-top: 17px;
          color: #a9c5b3;
          font-size: 12px;
          letter-spacing: 0.5px;
        }

        @keyframes rotate-ring {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes trophy-pulse {
          from {
            transform: scale(0.94);
          }
          to {
            transform: scale(1.06);
          }
        }

        @keyframes progress-fill {
          to {
            width: 100%;
          }
        }

        .history-section-title {
          text-align: center;
          padding: 12px 8px 20px;
        }

        .history-section-title > span {
          color: #56e69a;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .history-section-title h1 {
          font-size: 19px;
          margin: 8px 0 5px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .history-section-title p {
          color: #91a99a;
          font-size: 11px;
          margin: 0;
        }

        .old-history-title {
          margin-top: 28px;
          border-top: 1px solid #293a30;
          padding-top: 25px;
        }

        .draw-card {
          background: #19231d;
          border: 1px solid #2b3b31;
          border-radius: 12px;
          margin-bottom: 20px;
          overflow: hidden;
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

        .draw-header h2 {
          font-size: 18px;
          margin: 6px 0 0;
        }

        .prize-pool {
          text-align: right;
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
          font-size: 17px;
          margin-top: 5px;
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

        /* JACKPOT HISTORY STYLES */

        .jackpot-card {
          border-color: #806b35;
        }

        .jackpot-heading {
          padding: 17px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #3b3020, #263b2c);
          border-bottom: 1px solid #806b35;
        }

        .jackpot-label {
          color: #f5cf70;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.3px;
        }

        .jackpot-heading h2 {
          font-size: 18px;
          margin: 7px 0 4px;
          color: #ffffff;
        }

        .jackpot-heading p {
          color: #c4b995;
          font-size: 11px;
          margin: 0;
        }

        .jackpot-heading .prize-pool strong {
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

        .jackpot-avatar {
          background: #665329;
          color: #ffdf80;
        }

        .jackpot-winner-row {
          grid-template-columns: 1fr 1fr;
        }

        .ticket-id {
          color: #b6c7bb !important;
          font-size: 9px !important;
          overflow-wrap: anywhere;
        }

        .jackpot-prize {
          color: #f5cf70 !important;
          font-weight: 900;
        }

        .jackpot-empty {
          border-color: #665329;
        }

        @media (min-width: 600px) {
          .winner-container {
            padding: 30px 22px;
          }

          .winner-row {
            grid-template-columns: 1fr 1fr 150px;
          }

          .jackpot-winner-row {
            grid-template-columns: 1fr 1fr;
          }

          .verify-button {
            grid-column: auto;
          }
        }
      `}</style>
    </main>
  );
}
