
"use client";

import { useEffect, useState, Suspense, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

type VerifiedTicket = {
  ticket_number: string;
  draw_date: string;
  purchase_status: string;
  winner_status: string;
};

function formatDrawDate(value: string) {
  if (!value) return "Not Available";

  const date = new Date(value + "T00:00:00");

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-BD", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function TicketVerificationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(Boolean(token));
  const [searching, setSearching] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticket, setTicket] = useState<VerifiedTicket | null>(null);
  const [error, setError] = useState("");

  function applyVerifiedTicket(result: any) {
    if (!result?.success || !result?.valid || !result?.ticket) {
      throw new Error(result?.message || "Invalid Ticket. Ticket not found.");
    }

    setTicket({
      ticket_number: String(result.ticket.ticket_number || ""),
      draw_date: String(result.ticket.draw_date || ""),
      purchase_status: String(result.ticket.purchase_status || "Unknown"),
      winner_status: String(result.ticket.winner_status || "Unknown"),
    });
  }

  useEffect(() => {
    let active = true;

    async function verifyQrTicket() {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setTicket(null);

      try {
        const { data, error: functionError } =
          await supabase.functions.invoke("ticket-verify-public", {
            body: { token },
          });

        if (functionError) throw new Error(functionError.message);

        const result = data?.data ?? data;

        if (!result?.success || !result?.valid || !result?.ticket) {
          throw new Error(result?.message || "Invalid or unverified ticket.");
        }

        if (active) applyVerifiedTicket(result);
      } catch (err: any) {
        if (active) {
          setError(err?.message || "Ticket verification failed.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    verifyQrTicket();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleManualSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanNumber = ticketNumber.trim();

    if (!cleanNumber) {
      setError("Please enter your Ticket Number.");
      setTicket(null);
      return;
    }

    setSearching(true);
    setError("");
    setTicket(null);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("ticket-verify-public", {
          body: { ticket_number: cleanNumber },
        });

      if (functionError) throw new Error(functionError.message);

      const result = data?.data ?? data;
      applyVerifiedTicket(result);
    } catch (err: any) {
      setError(err?.message || "Ticket verification failed.");
    } finally {
      setSearching(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <main className="verification-page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .verification-page {
          min-height: 100vh;
          background: #101a14;
          color: #fff;
          padding: 35px 16px;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: Arial, sans-serif;
        }

        .verification-container {
          width: 100%;
          max-width: 440px;
          background: #18251d;
          border: 1px solid #315b40;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.3);
        }

        .ticket-card {
          width: 100%;
          overflow: hidden;
          border-radius: 9px;
          background: linear-gradient(
            155deg,
            #ff514c 0%,
            #d91e2b 48%,
            #8e071b 100%
          );
          color: #292929;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }

        .ticket-header {
          padding: 22px 15px 15px;
          text-align: center;
          color: #fff;
        }

        .ticket-brand {
          font-size: 39px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .ticket-subtitle {
          margin: 12px 0 0;
          padding: 10px;
          border-radius: 5px;
          background: #fff;
          color: #333;
          font-size: 17px;
          font-style: italic;
          font-weight: bold;
        }

        .ticket-number-strip {
          margin: 0 13px 10px;
          padding: 13px 8px;
          background: #fff;
          border-radius: 4px;
          text-align: center;
        }

        .ticket-number-label {
          display: block;
          color: #777;
          font-size: 10px;
          font-weight: bold;
          letter-spacing: 1.5px;
          margin-bottom: 6px;
        }

        .ticket-number-value {
          display: block;
          color: #252525;
          font-size: 23px;
          font-weight: 900;
          letter-spacing: 1px;
          overflow-wrap: anywhere;
        }

        .ticket-information {
          margin: 0 13px;
          padding: 17px 14px;
          background: #fff;
          border-radius: 4px;
        }

        .ticket-section-title {
          color: #a30e25;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 1px;
          padding-bottom: 8px;
          border-bottom: 2px solid #d51d31;
          margin-bottom: 12px;
        }

        .ticket-info-row {
          padding: 11px 0;
          border-bottom: 1px dashed #d7d7d7;
        }

        .ticket-info-row:last-child {
          border-bottom: none;
        }

        .ticket-info-label {
          color: #777;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .ticket-info-value {
          color: #292929;
          font-size: 15px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .ticket-footer {
          padding: 15px 12px 19px;
          text-align: center;
          color: #fff;
        }

        .ticket-verified {
          display: inline-block;
          padding: 7px 16px;
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 30px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .ticket-footer-note {
          font-size: 10px;
          line-height: 1.5;
          margin: 10px 0 0;
          color: #ffe5e5;
        }

        .print-button {
          width: 100%;
          margin-top: 17px;
          padding: 14px;
          border: none;
          border-radius: 8px;
          background: #fff;
          color: #a30e25;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .another-button {
          width: 100%;
          margin-top: 12px;
          padding: 13px;
          border: 1px solid #42634d;
          border-radius: 9px;
          background: #101a14;
          color: #00e701;
          font-weight: bold;
          cursor: pointer;
        }

        @media print {
          @page {
            size: 80mm auto;
            margin: 4mm;
          }

          html,
          body {
            width: 100%;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .ticket-card,
          .ticket-card * {
            visibility: visible !important;
          }

          .verification-page {
            display: block !important;
            min-height: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .verification-container {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }

          .ticket-card {
            width: 100% !important;
            margin: 0 auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .ticket-header,
          .ticket-footer,
          .ticket-card,
          .ticket-subtitle,
          .ticket-number-strip,
          .ticket-information {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <section className="verification-container">
        <div className="no-print" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 42 }}>🎟️</div>

          <h1
            style={{
              fontSize: 24,
              margin: "12px 0 6px",
              color: "#00E701",
            }}
          >
            LOTTERY
          </h1>

          <p style={{ color: "#b7c5bb", fontSize: 13 }}>
            OFFICIAL TICKET VERIFICATION
          </p>
        </div>

        {!token && !ticket && !loading && (
          <form
            className="no-print"
            onSubmit={handleManualSearch}
            style={{ marginTop: 25 }}
          >
            <p
              style={{
                color: "#b7c5bb",
                fontSize: 13,
                textAlign: "center",
                marginBottom: 14,
              }}
            >
              Enter your ticket number to verify its authenticity.
            </p>

            <input
              type="text"
              value={ticketNumber}
              onChange={(event) => setTicketNumber(event.target.value)}
              placeholder="Enter Ticket Number"
              autoComplete="off"
              style={{
                width: "100%",
                padding: "15px 13px",
                borderRadius: 9,
                border: "1px solid #42634d",
                background: "#101a14",
                color: "#fff",
                fontSize: 15,
                outline: "none",
                marginBottom: 12,
              }}
            />

            <button
              type="submit"
              disabled={searching}
              style={{
                width: "100%",
                padding: 14,
                border: "none",
                borderRadius: 9,
                background: searching ? "#477a50" : "#00E701",
                color: "#102016",
                fontSize: 15,
                fontWeight: "bold",
                cursor: searching ? "not-allowed" : "pointer",
              }}
            >
              {searching ? "Searching..." : "SEARCH TICKET"}
            </button>
          </form>
        )}

        {(loading || searching) && (
          <div
            className="no-print"
            style={{
              textAlign: "center",
              padding: "35px 5px",
              color: "#ddd",
            }}
          >
            <div style={{ fontSize: 30 }}>⏳</div>
            <p style={{ marginTop: 12 }}>Verifying Ticket...</p>
          </div>
        )}

        {!loading && !searching && error && (
          <div
            className="no-print"
            style={{
              marginTop: 25,
              padding: 18,
              background: "#351c20",
              border: "1px solid #8a343d",
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32 }}>❌</div>

            <h2 style={{ color: "#ff7777", marginTop: 10 }}>
              Verification Failed
            </h2>

            <p
              style={{
                color: "#f0c5c5",
                fontSize: 13,
                marginTop: 10,
                overflowWrap: "anywhere",
              }}
            >
              {error}
            </p>

            {!token && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setTicket(null);
                }}
                style={{
                  marginTop: 15,
                  padding: "10px 18px",
                  border: "1px solid #8a343d",
                  borderRadius: 8,
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {!loading && !searching && ticket && (
          <div style={{ marginTop: 25 }}>
            <div className="ticket-card">
              <div className="ticket-header">
                <div className="ticket-brand">LOTTO</div>
                <div className="ticket-subtitle">Official Lottery Ticket</div>
              </div>

              <div className="ticket-number-strip">
                <span className="ticket-number-label">TICKET NUMBER</span>
                <strong className="ticket-number-value">
                  {ticket.ticket_number}
                </strong>
              </div>

              <div className="ticket-information">
                <div className="ticket-section-title">
                  VERIFIED TICKET
                </div>

                <div className="ticket-info-row">
                  <div className="ticket-info-label">Ticket Number</div>
                  <div className="ticket-info-value">
                    {ticket.ticket_number}
                  </div>
                </div>

                <div className="ticket-info-row">
                  <div className="ticket-info-label">Draw Date</div>
                  <div className="ticket-info-value">
                    {formatDrawDate(ticket.draw_date)}
                  </div>
                </div>

                <div className="ticket-info-row">
                  <div className="ticket-info-label">Purchase Status</div>
                  <div className="ticket-info-value">
                    {ticket.purchase_status}
                  </div>
                </div>

                <div className="ticket-info-row">
                  <div className="ticket-info-label">Winner Status</div>
                  <div className="ticket-info-value">
                    {ticket.winner_status}
                  </div>
                </div>
              </div>

              <div className="ticket-footer">
                <div className="ticket-verified">
                  ✓ OFFICIALLY VERIFIED
                </div>

                <p className="ticket-footer-note">
                  This ticket information was verified by the official system.
                  <br />
                  Keep this ticket for your records.
                </p>
              </div>
            </div>

            <div className="no-print">
              <button
                type="button"
                className="print-button"
                onClick={handlePrint}
              >
                🖨️ PRINT TICKET
              </button>

              {!token && (
                <button
                  type="button"
                  className="another-button"
                  onClick={() => {
                    setTicket(null);
                    setTicketNumber("");
                    setError("");
                  }}
                >
                  VERIFY ANOTHER TICKET
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default function TicketVerificationPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#101a14",
            color: "#fff",
            display: "grid",
            placeItems: "center",
          }}
        >
          Verifying Ticket...
        </div>
      }
    >
      <TicketVerificationContent />
    </Suspense>
  );
}
