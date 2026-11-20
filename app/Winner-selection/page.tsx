
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

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

export default function WinnerSelectionPage() {
  const router = useRouter();

  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWinners = useCallback(async () => {
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

      setDraws(sortedDraws);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
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

  const formatMoney = (amount: number | null | undefined) => {
    return `৳${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <main className="winner-page">
      <div className="winner-container">

        <header className="winner-header">
          <div>
            <div className="winner-label">LOTTERY RESULTS</div>
            <h1>Winner List</h1>
            <p>Congratulations to all our winners!</p>
          </div>

          <button
            className="refresh-button"
            onClick={loadWinners}
            disabled={loading}
          >
            {loading ? "LOADING..." : "↻ REFRESH"}
          </button>
        </header>

        {loading && (
          <div className="message-box">
            Loading winner list...
          </div>
        )}

        {!loading && error && (
          <div className="error-box">
            <p>{error}</p>
            <button onClick={loadWinners}>
              TRY AGAIN
            </button>
          </div>
        )}

        {!loading && !error && draws.length === 0 && (
          <div className="message-box">
            No confirmed winners available yet.
          </div>
        )}

        {!loading && !error && draws.map((draw) => (
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

            {[...draw.winners]
              .map((winner, index) => ({
                winner,
                index,
              }))
              .map(({ winner, index }) => (
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
        ))}

        <footer className="winner-footer">
          <span>LOTTERY</span>
          <p>All completed draws and winners are displayed here.</p>
        </footer>

      </div>

      <style jsx>{`
        .winner-page {
          min-height: 100vh;
          background: #101512;
          color: #ffffff;
          padding: 24px 14px 45px;
          font-family: Arial, sans-serif;
        }

        .winner-container {
          max-width: 850px;
          margin: 0 auto;
        }

        .winner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 25px;
        }

        .winner-label {
          color: #30c879;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .winner-header h1 {
          font-size: 28px;
          margin: 7px 0;
          font-weight: 900;
        }

        .winner-header p {
          color: #9ba79f;
          font-size: 13px;
          margin: 0;
        }

        .refresh-button {
          background: #1c3428;
          color: #49dc91;
          border: 1px solid #326b4b;
          border-radius: 7px;
          padding: 10px 12px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .refresh-button:disabled {
          opacity: 0.5;
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

        .winner-footer {
          text-align: center;
          padding-top: 18px;
          color: #78877e;
          font-size: 11px;
        }

        .winner-footer span {
          color: #45d58a;
          font-weight: 900;
          letter-spacing: 2px;
        }

        @media (min-width: 600px) {
          .winner-page {
            padding: 35px 22px;
          }

          .winner-row {
            grid-template-columns: 1fr 1fr 150px;
          }

          .verify-button {
            grid-column: auto;
          }
        }
      `}</style>
    </main>
  );
}

