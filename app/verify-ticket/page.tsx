
"use client";

import {
  useEffect,
  useState,
  useRef,
  Suspense,
  FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import JsBarcode from "jsbarcode";
import { supabase } from "../../lib/supabase/client";

type TicketType = "lottery" | "jackpot";

type VerifiedTicket = {
  ticket_number: string;
  draw_date: string;
  purchase_status: string;
  winner_status: string;
  ticket_type: TicketType;
  prize_amount: number;
};

function formatDrawDate(value: string) {
  if (!value) return "Not Available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-BD", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatPrize(value: number) {
  return new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 2,
  }).format(value);
}

function TicketVerificationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const barcodeRef = useRef<SVGSVGElement>(null);

  const [loading, setLoading] = useState(Boolean(token));
  const [searching, setSearching] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticketType, setTicketType] =
    useState<TicketType>("lottery");
  const [ticket, setTicket] = useState<VerifiedTicket | null>(null);
  const [error, setError] = useState("");

  function applyVerifiedTicket(result: any) {
    if (!result?.success || !result?.valid || !result?.ticket) {
      throw new Error(
        result?.message || "Invalid Ticket. Ticket not found."
      );
    }

    const verifiedType =
      result.ticket.ticket_type === "jackpot"
        ? "jackpot"
        : "lottery";

    setTicket({
      ticket_number: String(result.ticket.ticket_number || ""),
      draw_date: String(result.ticket.draw_date || ""),
      purchase_status: String(
        result.ticket.purchase_status || "Unknown"
      ),
      winner_status: String(
        result.ticket.winner_status || "Unknown"
      ),
      ticket_type: verifiedType,
      prize_amount: Number(result.ticket.prize_amount || 0),
    });

    setTicketType(verifiedType);
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
          throw new Error(
            result?.message || "Invalid or unverified ticket."
          );
        }

        if (active) applyVerifiedTicket(result);
      } catch (err: any) {
        if (active) {
          setError(
            err?.message || "Ticket verification failed."
          );
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

  async function handleManualSearch(
    event: FormEvent<HTMLFormElement>
  ) {
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
          body: {
            ticket_number: cleanNumber,
            ticket_type: ticketType,
          },
        });

      if (functionError) throw new Error(functionError.message);

      const result = data?.data ?? data;
      applyVerifiedTicket(result);
    } catch (err: any) {
      setError(
        err?.message || "Ticket verification failed."
      );
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (!ticket?.ticket_number || !barcodeRef.current) return;

    try {
      JsBarcode(barcodeRef.current, ticket.ticket_number, {
        format: "CODE128",
        lineColor: "#171717",
        background: "#ffffff",
        width: 1.7,
        height: 43,
        displayValue: false,
        margin: 0,
      });
    } catch {
      if (barcodeRef.current) {
        barcodeRef.current.innerHTML = "";
      }
    }
  }, [ticket?.ticket_number]);

  function handlePrint() {
    window.print();
  }

  const isJackpot = ticket?.ticket_type === "jackpot";

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
          padding: 14px 12px 22px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          font-family: Arial, sans-serif;
        }

        .verification-container {
          width: 100%;
          max-width: 390px;
          background: #18251d;
          border: 1px solid #315b40;
          border-radius: 14px;
          padding: 16px;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }

        .ticket-card {
          width: 100%;
          overflow: hidden;
          border-radius: 8px;
          color: #292929;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
        }

        .ticket-card.lottery {
          background: linear-gradient(
            155deg,
            #ff514c 0%,
            #d91e2b 48%,
            #8e071b 100%
          );
        }

        .ticket-card.jackpot {
          background: linear-gradient(
            155deg,
            #e8bd55 0%,
            #b98521 48%,
            #65410b 100%
          );
        }

        .ticket-header {
          padding: 15px 12px 11px;
          text-align: center;
          color: #fff;
        }

        .ticket-brand {
          font-size: 34px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .ticket-subtitle {
          margin: 9px 0 0;
          padding: 8px;
          border-radius: 4px;
          background: #fff;
          color: #333;
          font-size: 15px;
          font-style: italic;
          font-weight: bold;
        }

        .ticket-number-strip {
          margin: 0 11px 8px;
          padding: 10px 7px;
          background: #fff;
          border-radius: 4px;
          text-align: center;
        }

        .ticket-number-label {
          display: block;
          color: #777;
          font-size: 9px;
          font-weight: bold;
          letter-spacing: 1.5px;
          margin-bottom: 5px;
        }

        .ticket-number-value {
          display: block;
          color: #252525;
          font-size: 21px;
          font-weight: 900;
          letter-spacing: 1px;
          overflow-wrap: anywhere;
        }

        .ticket-information {
          margin: 0 11px;
          padding: 12px 12px 10px;
          background: #fff;
          border-radius: 4px;
        }

        .ticket-section-title {
          color: #a30e25;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 1px;
          padding-bottom: 7px;
          border-bottom: 2px solid #d51d31;
          margin-bottom: 8px;
        }

        .ticket-card.jackpot .ticket-section-title {
          color: #80520b;
          border-bottom-color: #c18b24;
        }

        .ticket-info-row {
          padding: 8px 0;
          border-bottom: 1px dashed #d7d7d7;
        }

        .ticket-info-row:last-of-type {
          border-bottom: none;
        }

        .ticket-info-label {
          color: #777;
          font-size: 10px;
          font-weight: bold;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .ticket-info-value {
          color: #292929;
          font-size: 14px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .barcode-area {
          margin-top: 10px;
          padding: 8px 5px 5px;
          border-top: 1px dashed #bbb;
          text-align: center;
          background: #fff;
        }

        .ticket-barcode {
          display: block;
          width: 100%;
          max-width: 260px;
          height: 48px;
          margin: 0 auto;
        }

        .barcode-number {
          color: #222;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 1px;
          margin-top: 3px;
          overflow-wrap: anywhere;
        }

        .ticket-footer {
          padding: 11px 10px 14px;
          text-align: center;
          color: #fff;
        }

        .ticket-verified {
          display: inline-block;
          padding: 6px 14px;
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 30px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.2px;
        }

        .ticket-footer-note {
          font-size: 9px;
          line-height: 1.4;
          margin: 8px 0 0;
          color: #ffe5e5;
        }

        .ticket-card.jackpot .ticket-footer-note {
          color: #fff2d1;
        }

        .print-button {
          width: 100%;
          margin-top: 13px;
          padding: 13px;
          border: none;
          border-radius: 8px;
          background: #fff;
          color: #a30e25;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .another-button {
          width: 100%;
          margin-top: 10px;
          padding: 12px;
          border: 1px solid #42634d;
          border-radius: 9px;
          background: #101a14;
          color: #00e701;
          font-weight: bold;
          cursor: pointer;
        }

        .type-selector {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .type-option {
          flex: 1;
          padding: 11px 6px;
          border: 1px solid #42634d;
          border-radius: 8px;
          background: #101a14;
          color: #b7c5bb;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
        }

        .type-option.selected {
          background: #00e701;
          border-color: #00e701;
          color: #102016;
        }

        @media print {
          @page {
            size: 80mm 160mm;
            margin: 0;
          }

          html,
          body {
            width: 80mm !important;
            height: 160mm !important;
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
            width: 80mm !important;
            height: 160mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .verification-container {
            display: block !important;
            width: 80mm !important;
            max-width: 80mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 3mm !important;
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }

          .ticket-card {
            display: block !important;
            width: 74mm !important;
            max-width: 74mm !important;
            margin: 0 auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .ticket-header,
          .ticket-footer,
          .ticket-card,
          .ticket-subtitle,
          .ticket-number-strip,
          .ticket-information,
          .barcode-area {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .ticket-barcode {
            max-width: 62mm !important;
            height: 13mm !important;
          }
        }
      `}</style>

      <section className="verification-container">
        <div className="no-print" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>🎟️</div>

          <h1
            style={{
              fontSize: 21,
              margin: "7px 0 4px",
              color: "#00E701",
            }}
          >
            {isJackpot ? "JACKPOT" : "LOTTERY"}
          </h1>

          <p style={{ color: "#b7c5bb", fontSize: 11 }}>
            OFFICIAL TICKET VERIFICATION
          </p>
        </div>

        {!token && !ticket && !loading && (
          <form
            className="no-print"
            onSubmit={handleManualSearch}
            style={{ marginTop: 18 }}
          >
            <p
              style={{
                color: "#b7c5bb",
                fontSize: 12,
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              Select ticket type and enter your ticket number.
            </p>

            <div className="type-selector">
              <button
                type="button"
                className={`type-option ${
                  ticketType === "lottery" ? "selected" : ""
                }`}
                onClick={() => setTicketType("lottery")}
              >
                LOTTERY
              </button>

              <button
                type="button"
                className={`type-option ${
                  ticketType === "jackpot" ? "selected" : ""
                }`}
                onClick={() => setTicketType("jackpot")}
              >
                JACKPOT
              </button>
            </div>

            <input
              type="text"
              value={ticketNumber}
              onChange={(event) =>
                setTicketNumber(event.target.value)
              }
              placeholder="Enter Ticket Number"
              autoComplete="off"
              style={{
                width: "100%",
                padding: "13px 12px",
                borderRadius: 8,
                border: "1px solid #42634d",
                background: "#101a14",
                color: "#fff",
                fontSize: 14,
                outline: "none",
                marginBottom: 10,
              }}
            />

            <button
              type="submit"
              disabled={searching}
              style={{
                width: "100%",
                padding: 13,
                border: "none",
                borderRadius: 8,
                background: searching ? "#477a50" : "#00E701",
                color: "#102016",
                fontSize: 14,
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
              padding: "25px 5px",
              color: "#ddd",
            }}
          >
            <div style={{ fontSize: 28 }}>⏳</div>
            <p style={{ marginTop: 10 }}>Verifying Ticket...</p>
          </div>
        )}

        {!loading && !searching && error && (
          <div
            className="no-print"
            style={{
              marginTop: 20,
              padding: 16,
              background: "#351c20",
              border: "1px solid #8a343d",
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 30 }}>❌</div>

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
                  marginTop: 14,
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
          <div style={{ marginTop: 15 }}>
            <div
              className={`ticket-card ${
                ticket.ticket_type === "jackpot"
                  ? "jackpot"
                  : "lottery"
              }`}
            >
              <div className="ticket-header">
                <div className="ticket-brand">
                  {ticket.ticket_type === "jackpot"
                    ? "JACKPOT"
                    : "LOTTO"}
                </div>

                <div className="ticket-subtitle">
                  {ticket.ticket_type === "jackpot"
                    ? "Official Jackpot Ticket"
                    : "Official Lottery Ticket"}
                </div>
              </div>

              <div className="ticket-number-strip">
                <span className="ticket-number-label">
                  TICKET NUMBER
                </span>

                <strong className="ticket-number-value">
                  {ticket.ticket_number}
                </strong>
              </div>

              <div className="ticket-information">
                <div className="ticket-section-title">
                  VERIFIED TICKET
                </div>

                <div className="ticket-info-row">
                  <div className="ticket-info-label">
                    Ticket Number
                  </div>
                  <div className="ticket-info-value">
                    {ticket.ticket_number}
                  </div>
                </div>

                <div className="ticket-info-row">
                  <div className="ticket-info-label">
                    Draw Date
                  </div>
                  <div className="ticket-info-value">
                    {formatDrawDate(ticket.draw_date)}
                  </div>
                </div>

                <div className="ticket-info-row">
                  <div className="ticket-info-label">
                    Purchase Status
                  </div>
                  <div className="ticket-info-value">
                    {ticket.purchase_status}
                  </div>
                </div>

                <div className="ticket-info-row">
                  <div className="ticket-info-label">
                    Winner Status
                  </div>
                  <div className="ticket-info-value">
                    {ticket.winner_status}
                  </div>
                </div>

                {ticket.ticket_type === "jackpot" &&
                  ticket.prize_amount > 0 && (
                    <div className="ticket-info-row">
                      <div className="ticket-info-label">
                        Prize Amount
                      </div>
                      <div className="ticket-info-value">
                        ৳{formatPrize(ticket.prize_amount)}
                      </div>
                    </div>
                  )}

                <div className="barcode-area">
                  <svg
                    ref={barcodeRef}
                    className="ticket-barcode"
                  />

                  <div className="barcode-number">
                    {ticket.ticket_number}
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
                    setTicketType("lottery");
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
