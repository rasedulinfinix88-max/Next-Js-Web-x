
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { useLanguage } from "../../../lib/LanguageContext";
import LotteryHeader from "../../../components/Header/Header";
import LotteryFooter from "../../../components/Footer/Footer";
import "./tickets-buy-activity.css";

type Profile = {
  id: string;
  full_name: string | null;
  lottery_id: string | null;
  balance: number;
};

type DrawInfo = {
  draw_id: string;
  draw_date: string;
  status: string;
  ticket_price: number;
  total_tickets_sold: number;
  total_jackpot: number;
  prize_amount: number;
};

type PurchasedTicket = {
  id: string;
  number: string;
  draw_id: string;
  price: number;
};

function unwrapResponse(response: any): any {
  let result = response;

  for (let i = 0; i < 3; i++) {
    if (result?.data !== undefined) {
      result = result.data;
    } else {
      break;
    }
  }

  if (Array.isArray(result)) {
    return result[0] ?? null;
  }

  return result;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.random() * 16 | 0;
      const value =
        character === "x" ? random : (random & 0x3 | 0x8);

      return value.toString(16);
    }
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: string): string {
  if (!value) return "Not Available";

  return new Date(value + "T00:00:00").toLocaleDateString(
    "en-BD",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function TicketBuyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const drawId = searchParams.get("draw_id");

  const { language, t } = useLanguage();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [draw, setDraw] = useState<DrawInfo | null>(null);
  const [ticket, setTicket] = useState<PurchasedTicket | null>(null);

  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // একই Purchase-এর Retry হলে একই Request ID ব্যবহার হবে।
  const pendingRequestId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setError("");

      try {
        if (!drawId) {
          throw new Error(
            t(
              "Draw ID is missing. Please select a draw first.",
              "Draw ID পাওয়া যায়নি। অনুগ্রহ করে Draw নির্বাচন করুন।"
            )
          );
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/Client/Login/");
          return;
        }

        const { data: profileData, error: profileError } =
          await supabase
            .from("profiles")
            .select("id, full_name, lottery_id, balance")
            .eq("id", user.id)
            .single();

        if (profileError || !profileData) {
          throw new Error(
            t(
              "Your account information could not be loaded.",
              "আপনার Account Information পাওয়া যায়নি।"
            )
          );
        }

        if (!active) return;

        setProfile({
          ...profileData,
          balance: Number(profileData.balance || 0),
        });

        const { data: drawResponse, error: drawError } =
          await supabase.functions.invoke("ticket-manager", {
            body: {
              action: "draw_status",
              draw_id: drawId,
            },
          });

        if (drawError) {
          throw new Error(drawError.message);
        }

        if (
          !drawResponse ||
          drawResponse.success === false ||
          drawResponse.error
        ) {
          throw new Error(
            drawResponse?.message ||
            drawResponse?.error ||
            "Draw information could not be loaded."
          );
        }

        const drawData = unwrapResponse(drawResponse);

        if (!drawData || !drawData.draw_id) {
          throw new Error(
            t(
              "Draw information was not found.",
              "এই Draw-এর তথ্য পাওয়া যায়নি।"
            )
          );
        }

        if (!active) return;

        setDraw({
          draw_id: drawData.draw_id,
          draw_date: drawData.draw_date,
          status: drawData.status,
          ticket_price: Number(drawData.ticket_price || 0),
          total_tickets_sold: Number(
            drawData.total_tickets_sold || 0
          ),
          total_jackpot: Number(drawData.total_jackpot || 0),
          prize_amount: Number(drawData.prize_amount || 0),
        });
      } catch (err: any) {
        if (active) {
          setError(
            err?.message ||
            t("Something went wrong.", "কিছু একটা সমস্যা হয়েছে।")
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, [drawId, router, t]);

  const handleBuyTicket = async () => {
    if (!draw || !profile || !drawId || buying) return;

    setError("");
    setSuccess("");

    if (draw.status !== "open") {
      setError(
        t(
          "Ticket purchase is not available for this draw.",
          "এই Draw-এ বর্তমানে Ticket কেনা যাচ্ছে না।"
        )
      );
      return;
    }

    if (draw.ticket_price <= 0) {
      setError(
        t("Invalid ticket price.", "Ticket Price সঠিক নয়।")
      );
      return;
    }

    if (profile.balance < draw.ticket_price) {
      setError(
        t(
          "Your wallet balance is insufficient.",
          "আপনার Wallet Balance পর্যাপ্ত নয়।"
        )
      );
      return;
    }

    setBuying(true);

    try {
      if (!pendingRequestId.current) {
        pendingRequestId.current = createRequestId();
      }

      const { data: response, error: functionError } =
        await supabase.functions.invoke("ticket-manager", {
          body: {
            action: "buy_ticket",
            draw_id: drawId,
            request_id: pendingRequestId.current,
          },
        });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (
        !response ||
        response.success === false ||
        response.error
      ) {
        throw new Error(
          response?.message ||
          response?.error ||
          t("Ticket purchase failed.", "Ticket কেনা যায়নি।")
        );
      }

      const result = unwrapResponse(response);

      const ticketData = result?.ticket || result;

      const ticketNumber =
        ticketData?.ticket_number ||
        ticketData?.number ||
        result?.ticket_number;

      if (!ticketNumber) {
        throw new Error(
          t(
            "Ticket number was not returned by the server.",
            "Backend থেকে Ticket Number পাওয়া যায়নি।"
          )
        );
      }

      setTicket({
        id: ticketData?.id || "",
        number: String(ticketNumber),
        draw_id: ticketData?.draw_id || drawId,
        price: Number(
          ticketData?.ticket_price ||
          ticketData?.price ||
          draw.ticket_price
        ),
      });

      const walletData = result?.wallet || {};

      const updatedBalance =
        walletData?.balance_after ??
        result?.balance_after ??
        result?.wallet_balance;

      setProfile((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          balance:
            updatedBalance !== undefined &&
            updatedBalance !== null
              ? Number(updatedBalance)
              : Math.max(
                  0,
                  previous.balance - draw.ticket_price
                ),
        };
      });

      setDraw((previous) =>
        previous
          ? {
              ...previous,
              total_tickets_sold:
                previous.total_tickets_sold + 1,
            }
          : previous
      );

      pendingRequestId.current = null;

      setSuccess(
        t(
          "Congratulations! Your ticket was purchased successfully.",
          "অভিনন্দন! আপনার Ticket সফলভাবে কেনা হয়েছে।"
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
        t("Ticket purchase failed.", "Ticket কেনা ব্যর্থ হয়েছে।")
      );
    } finally {
      setBuying(false);
    }
  };

  const handleReloadBalance = () => {
    router.push("/Lottery/Secure-payment");
  };

  const barcodeUrl = ticket?.number
    ? `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(
        ticket.number
      )}&scale=2&height=14&includetext=false`
    : "";

  const isDrawOpen = draw?.status === "open";

  const headerProfile = profile
    ? {
        ...profile,
        game_id: profile.lottery_id,
        lottery_balance: profile.balance,
      }
    : undefined;

  if (loading) {
    return (
      <div className="ticket-buy-page">
        <div
          className="ticket-buy-main"
          style={{
            textAlign: "center",
            paddingTop: 80,
          }}
        >
          <div className="ticket-loader" style={{ fontSize: 42 }}>
            🎟️
          </div>

          <p>
            {t("Loading Ticket Information...", "Ticket Information লোড হচ্ছে...")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <LotteryHeader userProfile={headerProfile} />

      <div className="ticket-buy-page">
        <main className="ticket-buy-main">

          {!draw ? (
            <div className="input-section">
              <h3>
                {t("Ticket Information", "Ticket Information")}
              </h3>

              {error && (
                <p className="error-msg">{error}</p>
              )}
            </div>
          ) : (
            <>
              {/* Ticket Preview */}
              <div className="ticket-preview-card">
                <div className="ticket-left">
                  <h1 className="ticket-title">
                    LOTTERY
                  </h1>

                  <div className="ticket-subtitle">
                    OFFICIAL DRAW TICKET
                  </div>

                  <div className="prize-pool-display">
                    <span className="pool-label">
                      {t("PRIZE AMOUNT", "পুরস্কারের পরিমাণ")}
                    </span>

                    <span className="pool-amount">
                      ৳ {formatMoney(draw.prize_amount)}
                    </span>
                  </div>

                  <div className="ticket-price-tag">
                    ৳ {formatMoney(draw.ticket_price)}
                  </div>
                </div>

                <div className="ticket-divider" />

                <div className="ticket-right">
                  <div className="barcode-vertical-wrapper">
                    {barcodeUrl ? (
                      <img
                        src={barcodeUrl}
                        alt="Ticket Barcode"
                      />
                    ) : (
                      <span
                        style={{
                          color: "#000",
                          fontSize: 10,
                        }}
                      >
                        TICKET
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Draw Information */}
              <div className="input-section">
                <div className="live-counter-container">
                  <div className="live-badge">
                    <span className="live-dot" />
                    {isDrawOpen
                      ? t("DRAW OPEN", "ড্র চালু")
                      : t("DRAW CLOSED", "ড্র বন্ধ")}
                  </div>

                  <div className="sold-badge">
                    {t("SOLD", "বিক্রি হয়েছে")}:{" "}
                    {formatMoney(draw.total_tickets_sold)}
                  </div>
                </div>

                <div className="draw-watching-badge">
                  <span className="live-dot" />

                  {t("Draw Date", "ড্র-এর তারিখ")}:{" "}
                  {formatDate(draw.draw_date)}
                </div>

                {/* Server Generated Ticket Number */}
                <div style={{ marginTop: 18 }}>
                  <div className="helper-text">
                    <span>
                      {t("Ticket Number", "টিকিট নম্বর")}
                    </span>

                    <span>
                      {t("Backend Generated", "স্বয়ংক্রিয়ভাবে তৈরি")}
                    </span>
                  </div>

                  <div
                    className="ticket-number-input"
                    style={{
                      marginTop: 8,
                      minHeight: 52,
                    }}
                  >
                    {ticket
                      ? ticket.number
                      : t(
                          "Generated After Purchase",
                          "কেনার পর তৈরি হবে"
                        )}
                  </div>

                  <div className="helper-text">
                    <span>Draw ID</span>

                    <span>
                      {draw.draw_id.slice(0, 8)}...
                    </span>
                  </div>
                </div>

                {ticket && (
                  <div
                    style={{
                      marginTop: 16,
                      textAlign: "center",
                    }}
                  >
                    <strong>
                      {t("Purchased Ticket", "কেনা টিকিট")}
                    </strong>

                    <p
                      style={{
                        color: "#00E701",
                        fontWeight: 800,
                        marginTop: 6,
                      }}
                    >
                      {ticket.number}
                    </p>
                  </div>
                )}

                <div className="disclaimer-box">
                  <p>
                    <strong>
                      {t("Important:", "গুরুত্বপূর্ণ:")}
                    </strong>{" "}
                    {t(
                      "Your Ticket Number will be generated automatically by the Backend. Each ticket is a separate chance in the draw.",
                      "আপনার Ticket Number Backend থেকে স্বয়ংক্রিয়ভাবে তৈরি হবে। প্রতিটি Ticket আলাদা Winning Chance হিসেবে গণ্য হবে।"
                    )}
                  </p>
                </div>

                {error && (
                  <p className="error-msg">{error}</p>
                )}

                {success && (
                  <p className="success-msg">{success}</p>
                )}
              </div>

              {/* Wallet Information */}
              <div className="input-section">
                <div className="helper-text">
                  <span>
                    {t("Wallet Balance", "ওয়ালেট ব্যালেন্স")}
                  </span>

                  <strong style={{ color: "#FFFFFF" }}>
                    ৳ {formatMoney(profile?.balance || 0)}
                  </strong>
                </div>

                <div
                  className="button-group"
                  style={{ marginTop: 12 }}
                >
                  <button
                    type="button"
                    className="action-btn"
                    onClick={handleReloadBalance}
                  >
                    {t("Reload Balance", "ব্যালেন্স রিলোড")}
                  </button>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Fixed Buy Button */}
        {draw && (
          <div className="submit-btn-wrapper">
            <button
              type="button"
              className="buy-ticket-btn"
              onClick={handleBuyTicket}
              disabled={
                buying ||
                !isDrawOpen ||
                !profile ||
                profile.balance < draw.ticket_price
              }
            >
              {buying
                ? t("PROCESSING...", "প্রসেসিং...")
                : !isDrawOpen
                  ? t("DRAW NOT OPEN", "ড্র চালু নেই")
                  : profile &&
                    profile.balance < draw.ticket_price
                    ? t(
                        "INSUFFICIENT BALANCE",
                        "পর্যাপ্ত ব্যালেন্স নেই"
                      )
                    : `${t("BUY TICKET", "টিকিট কিনুন")} - ৳ ${formatMoney(
                        draw.ticket_price
                      )}`}
            </button>
          </div>
        )}
      </div>

      <LotteryFooter />
    </>
  );
}

export default function TicketBuyPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: 30,
            textAlign: "center",
          }}
        >
          Loading...
        </div>
      }
    >
      <TicketBuyContent />
    </Suspense>
  );
}
