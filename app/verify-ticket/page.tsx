
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

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#101a14",
        color: "#fff",
        padding: "35px 16px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#18251d",
          border: "1px solid #315b40",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 12px 35px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ textAlign: "center" }}>
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
          <form onSubmit={handleManualSearch} style={{ marginTop: 25 }}>
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
                boxSizing: "border-box",
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
            style={{
              textAlign: "center",
              padding: "35px 5px",
              color: "#ddd",
            }}
          >
            <div style={{ fontSize: 30 }}>⏳</div>
            <p style={{ marginTop: 12 }}>
              Verifying Ticket...
            </p>
          </div>
        )}

        {!loading && !searching && error && (
          <div
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
            <div
              style={{
                textAlign: "center",
                background: "#123321",
                border: "1px solid #00a94f",
                padding: 14,
                borderRadius: 10,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 28 }}>✅</div>

              <strong
                style={{
                  color: "#00E701",
                  display: "block",
                  marginTop: 6,
                }}
              >
                VERIFIED TICKET
              </strong>
            </div>

            {[
              ["Ticket Number", ticket.ticket_number],
              ["Draw Date", formatDrawDate(ticket.draw_date)],
              ["Purchase Status", ticket.purchase_status],
              ["Winner Status", ticket.winner_status],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: "15px 12px",
                  borderBottom: "1px solid #34483a",
                }}
              >
                <div
                  style={{
                    color: "#aebdb2",
                    fontSize: 12,
                    marginBottom: 7,
                  }}
                >
                  {label}
                </div>

                <strong
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    overflowWrap: "anywhere",
                  }}
                >
                  {value}
                </strong>
              </div>
            ))}

            <p
              style={{
                textAlign: "center",
                color: "#aebdb2",
                fontSize: 11,
                marginTop: 22,
              }}
            >
              This verification confirms the ticket information
              returned by the official system.
            </p>

            {!token && (
              <button
                type="button"
                onClick={() => {
                  setTicket(null);
                  setTicketNumber("");
                  setError("");
                }}
                style={{
                  width: "100%",
                  marginTop: 18,
                  padding: 13,
                  border: "1px solid #42634d",
                  borderRadius: 9,
                  background: "#101a14",
                  color: "#00E701",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                VERIFY ANOTHER TICKET
              </button>
            )}
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
