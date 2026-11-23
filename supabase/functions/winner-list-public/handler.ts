
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getEncryptionKey(secret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("ticket-qr-v1:" + secret),
  );

  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
}

async function createTicketToken(
  ticketId: string,
  serviceKey: string,
  ticketType: "lottery" | "jackpot" = "lottery",
) {
  const key = await getEncryptionKey(serviceKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const payload = new TextEncoder().encode(
    JSON.stringify({
      v: 1,
      ticket_id: ticketId,
      ticket_type: ticketType,
    }),
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    payload,
  );

  const encryptedBytes = new Uint8Array(encrypted);

  const combined = new Uint8Array(
    iv.length + encryptedBytes.length,
  );

  combined.set(iv);
  combined.set(encryptedBytes, iv.length);

  return toBase64Url(combined);
}

function maskWinnerName(name: string) {
  const chars = Array.from(name.trim());

  if (chars.length === 0) {
    return "Unknown";
  }

  if (chars.length <= 3) {
    return chars[0] + "*****";
  }

  return chars[0] + "*****" + chars.slice(-2).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json({
      success: false,
      message: "Method not allowed",
    }, 405);
  }

  try {
    const projectUrl = Deno.env.get("PROJECT_URL");
    const serviceKey = Deno.env.get("PROJECT_SERVICE_KEY");

    if (!projectUrl || !serviceKey) {
      console.error("Winner list configuration missing.");

      return json({
        success: false,
        message: "Server configuration error",
      }, 500);
    }

    const admin = createClient(projectUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // ==========================================
    // OLD WINNER HISTORY - EXISTING LOGIC
    // ==========================================

    const { data: draws, error: drawError } = await admin
      .from("ticket_draws")
      .select("id, draw_date, total_jackpot")
      .eq("status", "completed")
      .order("draw_date", { ascending: false });

    if (drawError) {
      console.error("Draw query failed:", drawError.message);

      return json({
        success: false,
        message: "Could not load completed draws",
      }, 500);
    }

    const result = [];

    for (const draw of draws || []) {
      const winners = [];
      let start = 0;
      const pageSize = 1000;

      while (true) {
        const { data: tickets, error: ticketError } = await admin
          .from("ticket_purchases")
          .select(
            "id, user_id, ticket_number, ticket_price, prize_amount",
          )
          .eq("draw_id", draw.id)
          .eq("is_winner", true)
          .order("ticket_number", { ascending: true })
          .range(start, start + pageSize - 1);

        if (ticketError) {
          console.error(
            "Winner ticket query failed:",
            ticketError.message,
          );

          return json({
            success: false,
            message: "Could not load winner tickets",
          }, 500);
        }

        if (!tickets || tickets.length === 0) {
          break;
        }

        winners.push(...tickets);

        if (tickets.length < pageSize) {
          break;
        }

        start += pageSize;
      }

      if (winners.length === 0) {
        continue;
      }

      const userIds = [
        ...new Set(
          winners.map((ticket) => ticket.user_id),
        ),
      ];

      const profilesById = new Map<string, string>();

      for (let i = 0; i < userIds.length; i += 500) {
        const userBatch = userIds.slice(i, i + 500);

        const { data: profiles, error: profileError } = await admin
          .from("profiles")
          .select("id, full_name")
          .in("id", userBatch);

        if (profileError) {
          console.error(
            "Winner profile query failed:",
            profileError.message,
          );

          return json({
            success: false,
            message: "Could not load winner names",
          }, 500);
        }

        for (const profile of profiles || []) {
          profilesById.set(
            profile.id,
            profile.full_name || "",
          );
        }
      }

      const drawWinners = [];

      for (const ticket of winners) {
        const fullName =
          profilesById.get(ticket.user_id) || "";

        const token = await createTicketToken(
          ticket.id,
          serviceKey,
        );

        drawWinners.push({
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          ticket_price: ticket.ticket_price,
          prize_amount: ticket.prize_amount,
          winner_name_masked: maskWinnerName(fullName),
          token,
          sort_name: fullName,
        });
      }

      drawWinners.sort((a, b) =>
        a.sort_name.localeCompare(
          b.sort_name,
          "en",
          { sensitivity: "base" },
        )
      );

      result.push({
        draw_id: draw.id,
        draw_date: draw.draw_date,
        total_jackpot: draw.total_jackpot,
        winners: drawWinners.map((winner) => {
          const { sort_name, ...publicWinner } = winner;
          return publicWinner;
        }),
      });
    }

    // ==========================================
    // NEW JACKPOT WINNING HISTORY
    // ==========================================

    const jackpotResult = [];

    const { data: publishedResults, error: jackpotError } =
      await admin
        .from("jackpot_draw_results")
        .select(
          "draw_id, winning_ticket_id, winning_ticket_number, winner_user_id, prize_amount, published_at",
        )
        .eq("result_status", "published")
        .order("published_at", { ascending: false });

    if (jackpotError) {
      console.error(
        "Jackpot result query failed:",
        jackpotError.message,
      );

      return json({
        success: false,
        message: "Could not load Jackpot history",
      }, 500);
    }

    if (publishedResults && publishedResults.length > 0) {
      const drawIds = [
        ...new Set(
          publishedResults.map((item) => item.draw_id),
        ),
      ];

      const { data: jackpotDraws, error: jackpotDrawError } =
        await admin
          .from("jackpot_draws")
          .select(
            "id, category, ticket_price, prize_amount, draw_at, status, total_tickets_sold",
          )
          .in("id", drawIds)
          .eq("status", "published");

      if (jackpotDrawError) {
        console.error(
          "Jackpot draw query failed:",
          jackpotDrawError.message,
        );

        return json({
          success: false,
          message: "Could not load Jackpot draw details",
        }, 500);
      }

      const jackpotDrawById = new Map(
        (jackpotDraws || []).map((draw) => [draw.id, draw]),
      );

      const jackpotUserIds = [
        ...new Set(
          publishedResults.map((item) => item.winner_user_id),
        ),
      ];

      const jackpotProfilesById = new Map<string, string>();

      for (let i = 0; i < jackpotUserIds.length; i += 500) {
        const userBatch = jackpotUserIds.slice(i, i + 500);

        const { data: profiles, error: profileError } = await admin
          .from("profiles")
          .select("id, full_name")
          .in("id", userBatch);

        if (profileError) {
          console.error(
            "Jackpot winner profile query failed:",
            profileError.message,
          );

          return json({
            success: false,
            message: "Could not load Jackpot winner names",
          }, 500);
        }

        for (const profile of profiles || []) {
          jackpotProfilesById.set(
            profile.id,
            profile.full_name || "",
          );
        }
      }

      for (const item of publishedResults) {
        const draw = jackpotDrawById.get(item.draw_id);

        if (!draw) {
          continue;
        }

        const fullName =
          jackpotProfilesById.get(item.winner_user_id) || "";

        const token = await createTicketToken(
          item.winning_ticket_id,
          serviceKey,
          "jackpot",
        );

        jackpotResult.push({
          draw_id: item.draw_id,
          category: draw.category,
          draw_date: draw.draw_at,
          ticket_price: draw.ticket_price,
          total_jackpot: draw.prize_amount,
          total_tickets_sold: draw.total_tickets_sold,
          published_at: item.published_at,
          winners: [
            {
              ticket_id: item.winning_ticket_id,
              ticket_number: item.winning_ticket_number,
              ticket_price: draw.ticket_price,
              prize_amount: item.prize_amount,
              winner_name_masked: maskWinnerName(fullName),
              token,
            },
          ],
        });
      }
    }

    // OLD "draws" response preserved.
    // NEW "jackpot_draws" response added.

    return json({
      success: true,
      draws: result,
      jackpot_draws: jackpotResult,
    });

  } catch (error) {
    console.error(
      "Public winner list error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return json({
      success: false,
      message: "Winner list loading failed",
    }, 500);
  }
});
