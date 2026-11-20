
"use client";

import { useEffect, useState, Suspense } from "react";
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

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-BD", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function TicketVerificationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<VerifiedTicket | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function verifyTicket() {
      setLoading(true);
      setError("");
      setTicket(null);

      try {
        if (!token) {
          throw new Error("QR verification token is missing.");
        }

        const { data, error: functionError } =
          await supabase.functions.invoke("ticket-verify-public", {
            body: { token },
          });

        if (functionError) {
          throw new Error(functionError.message);
        }

        const result = data?.data ?? data;

        if (!result?.success || !result?.valid || !result?.ticket) {
          throw new Error("Invalid or unverified ticket.");
        }

        if (!active) return;

        setTicket({
          ticket_number: String(result.ticket.ticket_number || ""),
          draw_date: String(result.ticket.draw_date || ""),
          purchase_status: String(
            result.ticket.purchase_status || "Unknown"
          ),
          winner_status: String(
            result.ticket.winner_status || "Unknown"
          ),
        });
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

    verifyTicket();

    return () => {
      active = false;
    };
  }, [token]);

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

        {loading && (
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

        {!loading && error && (
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
          </div>
        )}

        {!loading && ticket && (
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
