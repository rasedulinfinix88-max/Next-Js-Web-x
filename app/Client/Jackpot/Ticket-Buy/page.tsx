
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import LotteryHeader from "../../../../components/Header/Header";
import LotteryFooter from "../../../../components/Footer/Footer";

type JackpotDraw = {
  id: string;
  category: number;
  ticket_price: number;
  prize_amount: number;
  sales_open_at: string;
  sales_close_at: string;
  draw_at: string;
  status: string;
  total_tickets_sold: number;
};

type Profile = {
  id: string;
  full_name: string | null;
  balance: number;
};

type PurchasedTicket = {
  id: string;
  ticket_number: string;
  ticket_price: number;
};

function createRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.random() * 16 | 0;
      const value =
        character === "x" ? random : (random & 3) | 8;

      return value.toString(16);
    }
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

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

function JackpotTicketBuyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const drawId = searchParams.get("draw_id");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [draw, setDraw] = useState<JackpotDraw | null>(null);
  const [ticket, setTicket] = useState<PurchasedTicket | null>(null);

  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [qrLoading, setQrLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrError, setQrError] = useState("");

  const pendingRequestId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setError("");

      try {
        if (!drawId) {
          throw new Error("Jackpot Draw ID পাওয়া যায়নি।");
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
            .select("id, full_name, balance")
            .eq("id", user.id)
            .single();

        if (profileError || !profileData) {
          throw new Error("আপনার Account Information পাওয়া যায়নি।");
        }

        if (!active) return;

        setProfile({
          id: profileData.id,
          full_name: profileData.full_name,
          balance: Number(profileData.balance || 0),
        });

        const { data: drawData, error: drawError } =
          await supabase
            .from("jackpot_draws")
            .select(
              "id, category, ticket_price, prize_amount, sales_open_at, sales_close_at, draw_at, status, total_tickets_sold"
            )
            .eq("id", drawId)
            .maybeSingle();

        if (drawError) throw drawError;

        if (!drawData) {
          throw new Error("এই Jackpot Draw পাওয়া যায়নি।");
        }

        if (!active) return;

        setDraw({
          ...drawData,
          category: Number(drawData.category),
          ticket_price: Number(drawData.ticket_price),
          prize_amount: Number(drawData.prize_amount),
          total_tickets_sold: Number(
            drawData.total_tickets_sold || 0
          ),
        });
      } catch (err: any) {
        if (active) {
          setError(
            err?.message || "Jackpot Information লোড করা যায়নি।"
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
  }, [drawId, router]);

  const handleBuyTicket = async () => {
    if (!draw || !profile || !drawId || buying) return;

    setError("");
    setSuccess("");
    setQrUrl("");
    setQrError("");

    if (draw.status !== "open") {
      setError("এই Jackpot-এর Ticket Sale বর্তমানে চালু নেই।");
      return;
    }

    const now = Date.now();

    if (
      now < new Date(draw.sales_open_at).getTime() ||
      now >= new Date(draw.sales_close_at).getTime()
    ) {
      setError("Ticket কেনার নির্ধারিত সময়ের বাইরে চলে গেছেন।");
      return;
    }

    if (profile.balance < draw.ticket_price) {
      setError("আপনার Wallet Balance পর্যাপ্ত নয়।");
      return;
    }

    setBuying(true);

    try {
      if (!pendingRequestId.current) {
        pendingRequestId.current = createRequestId();
      }

      const { data: response, error: functionError } =
        await supabase.functions.invoke("jackpot-manager", {
          body: {
            action: "purchase_ticket",
            draw_id: drawId,
            request_id: pendingRequestId.current,
          },
        });

      if (functionError) {
        let details = functionError.message;

        const context = (
          functionError as { context?: unknown }
        ).context;

        if (context instanceof Response) {
          const body = await context.clone().text();
          details =
            `HTTP ${context.status}\n${body || details}`;
        }

        throw new Error(details);
      }

      if (
        !response ||
        response.success === false ||
        response.error
      ) {
        throw new Error(
          response?.message ||
            response?.error ||
            "Ticket Purchase সফল হয়নি।"
        );
      }

      const result = unwrapResponse(response);
      const ticketData = result?.ticket || result;

      const ticketNumber =
        ticketData?.ticket_number ||
        ticketData?.number ||
        result?.ticket_number;

      const ticketId =
        ticketData?.id ||
        ticketData?.ticket_id ||
        result?.ticket_id ||
        "";

      const wallet = result?.wallet || {};

      const updatedBalance =
        wallet?.balance_after ??
        result?.balance_after ??
        result?.wallet_balance;

      const purchasedTicket: PurchasedTicket = {
        id: String(ticketId),
        ticket_number: ticketNumber
          ? String(ticketNumber)
          : "",
        ticket_price: Number(
          ticketData?.ticket_price ||
          ticketData?.price ||
          draw.ticket_price
        ),
      };

      setTicket(purchasedTicket);

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

      // Purchase has succeeded. Do not repeat the purchase
      // if QR generation fails.
      pendingRequestId.current = null;

      setSuccess(
        "অভিনন্দন! আপনার Jackpot Ticket সফলভাবে কেনা হয়েছে।"
      );

      // Generate Jackpot QR using the purchased ticket ID.
      if (!purchasedTicket.id) {
        setQrError(
          "Ticket কেনা সফল হয়েছে, কিন্তু Ticket ID পাওয়া যায়নি। QR তৈরি করা যায়নি।"
        );
        return;
      }

      setQrLoading(true);

      try {
        const { data: qrResponse, error: qrFunctionError } =
          await supabase.functions.invoke("ticket-qr-create", {
            body: {
              ticket_id: purchasedTicket.id,
              ticket_type: "jackpot",
            },
          });

        if (qrFunctionError) {
          let details = qrFunctionError.message;

          const context = (
            qrFunctionError as { context?: unknown }
          ).context;

          if (context instanceof Response) {
            const body = await context.clone().text();
            details =
              `HTTP ${context.status}\n${body || details}`;
          }

          throw new Error(details);
        }

        if (!qrResponse?.success || !qrResponse?.token) {
          throw new Error(
            qrResponse?.message || "QR Token পাওয়া যায়নি।"
          );
        }

        // GitHub Pages Base Path
        const verificationUrl = new URL(
          "/Next-Js-Web-x/verify-ticket/",
          window.location.origin
        );

        verificationUrl.searchParams.set(
          "token",
          qrResponse.token
        );

        const imageUrl =
          "https://api.qrserver.com/v1/create-qr-code/" +
          `?size=300x300&data=${encodeURIComponent(verificationUrl.toString())}`;

        setQrUrl(imageUrl);
      } catch (qrErr: any) {
        setQrError(
          qrErr?.message ||
            "Ticket কেনা হয়েছে, কিন্তু QR তৈরি করা যায়নি।"
        );
      } finally {
        setQrLoading(false);
      }
    } catch (err: any) {
      setError(
        err?.message || "Ticket Purchase ব্যর্থ হয়েছে।"
      );
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071510] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#d6a94d] border-t-transparent rounded-full animate-spin" />
        <p className="text-white mt-4 text-xs font-bold">
          LOADING JACKPOT TICKET...
        </p>
      </div>
    );
  }

  const headerProfile = profile
    ? {
        ...profile,
        game_id: "",
        lottery_balance: profile.balance,
      }
    : undefined;

  return (
    <>
      <LotteryHeader userProfile={headerProfile} />

      <main className="min-h-screen bg-[#071510] text-white px-3 py-6 pb-28">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => router.back()}
            className="text-sm text-[#e9c477] font-bold mb-5"
          >
            ← Back to Jackpot
          </button>

          <section className="rounded-2xl border border-[#b58b43]/40 bg-gradient-to-br from-[#183b2c] to-[#071510] p-5">
            <div className="text-center">
              <p className="text-[#e9c477] text-xs font-bold tracking-[3px]">
                WEEKLY GRAND DRAW
              </p>

              <h1 className="text-3xl font-black mt-2">
                JACKPOT
              </h1>

              {draw && (
                <>
                  <p className="text-gray-300 text-sm mt-3">
                    ৳{formatMoney(draw.category)} CATEGORY
                  </p>

                  <div className="mt-5 rounded-xl bg-black/30 p-4">
                    <p className="text-xs text-gray-400">
                      TOTAL PRIZE
                    </p>

                    <p className="text-3xl font-black text-[#f5c76b] mt-2">
                      ৳{formatMoney(draw.prize_amount)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-lg bg-black/30 p-3">
                      <p className="text-[11px] text-gray-400">
                        TICKET PRICE
                      </p>
                      <p className="font-bold mt-1">
                        ৳{formatMoney(draw.ticket_price)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-black/30 p-3">
                      <p className="text-[11px] text-gray-400">
                        TICKETS SOLD
                      </p>
                      <p className="font-bold mt-1">
                        {formatMoney(draw.total_tickets_sold)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-black/30 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">
                        Draw Status
                      </span>
                      <strong
                        className={
                          draw.status === "open"
                            ? "text-green-400"
                            : "text-yellow-300"
                        }
                      >
                        {draw.status.toUpperCase()}
                      </strong>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {draw && profile && (
            <section className="mt-5 rounded-2xl border border-white/10 bg-[#10231b] p-4">
              <h2 className="font-bold text-lg">
                Purchase Ticket
              </h2>

              <div className="flex justify-between mt-4 text-sm">
                <span className="text-gray-400">
                  Wallet Balance
                </span>
                <strong>
                  ৳{formatMoney(profile.balance)}
                </strong>
              </div>

              <div className="flex justify-between mt-3 text-sm">
                <span className="text-gray-400">
                  Ticket Price
                </span>
                <strong className="text-[#f5c76b]">
                  ৳{formatMoney(draw.ticket_price)}
                </strong>
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3">
                  <p className="text-red-300 text-sm whitespace-pre-wrap">
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="mt-4 rounded-lg border border-green-500/30 bg-green-950/30 p-3">
                  <p className="text-green-300 text-sm">
                    {success}
                  </p>
                </div>
              )}

              {ticket && (
                <div className="mt-4 rounded-xl border border-[#d6a94d]/40 bg-black/30 p-4 text-center">
                  <p className="text-[#e9c477] text-xs font-bold">
                    YOUR JACKPOT TICKET
                  </p>

                  {ticket.ticket_number ? (
                    <p className="text-2xl font-black tracking-wider mt-3">
                      {ticket.ticket_number}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-300 mt-3">
                      Purchase successful. Ticket number is not available in the response.
                    </p>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    Ticket Price: ৳{formatMoney(ticket.ticket_price)}
                  </p>

                  <div className="mt-5 border-t border-white/10 pt-5">
                    <p className="text-[#e9c477] text-sm font-bold">
                      JACKPOT TICKET QR
                    </p>

                    {qrLoading && (
                      <div className="py-8">
                        <div className="w-9 h-9 mx-auto border-4 border-[#d6a94d] border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-gray-400 mt-3">
                          GENERATING QR CODE...
                        </p>
                      </div>
                    )}

                    {qrUrl && (
                      <div className="mt-4 bg-white rounded-xl p-3 inline-block">
                        <img
                          src={qrUrl}
                          alt="Jackpot Ticket Verification QR Code"
                          width={240}
                          height={240}
                          className="w-60 h-60 max-w-full object-contain"
                        />
                      </div>
                    )}

                    {qrError && (
                      <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3">
                        <p className="text-red-300 text-xs">
                          {qrError}
                        </p>
                        <p className="text-gray-400 text-xs mt-2">
                          আপনার Ticket Purchase সফল হয়েছে। QR তৈরির সমস্যাটি আলাদাভাবে সমাধান করতে হবে।
                        </p>
                      </div>
                    )}

                    {qrUrl && (
                      <p className="text-xs text-gray-400 mt-3">
                        Scan this QR code to verify your Jackpot Ticket.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!ticket && (
                <button
                  type="button"
                  onClick={handleBuyTicket}
                  disabled={
                    buying ||
                    draw.status !== "open" ||
                    profile.balance < draw.ticket_price
                  }
                  className="w-full mt-5 rounded-xl py-4 font-black text-sm bg-[#e5a83b] text-[#071510] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {buying
                    ? "PROCESSING..."
                    : draw.status !== "open"
                    ? "SALES NOT OPEN"
                    : profile.balance < draw.ticket_price
                    ? "INSUFFICIENT BALANCE"
                    : `BUY TICKET - ৳${formatMoney(draw.ticket_price)}`}
                </button>
              )}
            </section>
          )}
        </div>
      </main>

      <LotteryFooter />
    </>
  );
}

export default function JackpotTicketBuyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#071510] text-white flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <JackpotTicketBuyContent />
    </Suspense>
  );
}
