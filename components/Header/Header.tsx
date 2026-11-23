
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import { useLanguage } from "../../lib/LanguageContext";
import { useSiteSettings } from "../../lib/SiteSettingsContext";

const Icons = {
  Bell: () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),

  Logout: () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),

  Globe: () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),

  Money: () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),

  List: () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),

  Document: () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),

  Ticket: () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 9a3 3 0 003-3h14a3 3 0 003 3v6a3 3 0 00-3 3H5a3 3 0 00-3-3V9zm10-3v2m0 3v2m0 3v2" />
    </svg>
  ),

  Support: () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 10a6 6 0 00-12 0v4a2 2 0 002 2h1v-5H8a4 4 0 018 0h-1v5h1a2 2 0 002-2v-4zM18 16a4 4 0 01-4 4h-2" />
    </svg>
  ),
};

type LotteryHeaderProps = {
  userProfile?: any;
  initialAuthChecked?: boolean;
  initialIsLoggedIn?: boolean;
};

export default function LotteryHeader({
  userProfile,
  initialAuthChecked = false,
  initialIsLoggedIn = false,
}: LotteryHeaderProps) {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { siteName, logoUrl } = useSiteSettings();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(
    initialAuthChecked ? initialIsLoggedIn : false
  );

  const [hasUnread, setHasUnread] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  // =========================================
  // Notification Check
  // =========================================

  useEffect(() => {
    let isMounted = true;
    let currentUserId: string | null = null;

    const fetchNotifications = async (userId: string) => {
      const [
        { data: notifications, error: notificationError },
        { data: reads, error: readError },
      ] = await Promise.all([
        supabase
          .from("notifications")
          .select("id"),

        supabase
          .from("notification_reads")
          .select("notification_id")
          .eq("user_id", userId),
      ]);

      if (!isMounted) return;

      if (notificationError || readError) {
        return;
      }

      const readIds = new Set(
        (reads || []).map((item) => item.notification_id)
      );

      const unreadExists = (notifications || []).some(
        (notification) => !readIds.has(notification.id)
      );

      setHasUnread(unreadExists);
    };

    const updateAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      const user = session?.user;

      currentUserId = user?.id || null;

      setIsLoggedIn(!!user);

      if (user) {
        await fetchNotifications(user.id);
      } else {
        setHasUnread(false);
      }
    };

    updateAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      const user = session?.user;

      currentUserId = user?.id || null;

      setIsLoggedIn(!!user);

      if (user) {
        fetchNotifications(user.id);
      } else {
        setHasUnread(false);
      }
    });

    const notificationInterval = setInterval(() => {
      if (currentUserId) {
        fetchNotifications(currentUserId);
      }
    }, 10000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearInterval(notificationInterval);
    };
  }, [
    userProfile,
    initialAuthChecked,
    initialIsLoggedIn,
  ]);

  // =========================================
  // User Balance Fetch + Realtime
  // =========================================

  useEffect(() => {
    let isMounted = true;
    let currentUserId: string | null = null;
    let balanceInterval: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchBalance = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", userId)
        .maybeSingle();

      if (!isMounted || currentUserId !== userId) return;

      if (error) {
        console.error("Balance fetch error:", error.message);
        return;
      }

      if (data) {
        const newBalance = Number(data.balance);

        if (Number.isFinite(newBalance)) {
          setBalance(newBalance);
        }
      }
    };

    const setupBalance = async (userId: string) => {
      if (currentUserId === userId && channel) return;

      currentUserId = userId;
      setBalance(null);

      if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
      }

      if (balanceInterval) {
        clearInterval(balanceInterval);
        balanceInterval = null;
      }

      await fetchBalance(userId);

      if (!isMounted || currentUserId !== userId) return;

      channel = supabase
        .channel(`header-balance-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            const updatedBalance = Number(payload.new.balance);

            if (Number.isFinite(updatedBalance)) {
              setBalance(updatedBalance);
            }
          }
        )
        .subscribe();

      balanceInterval = setInterval(() => {
        if (currentUserId === userId) {
          fetchBalance(userId);
        }
      }, 10000);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id || null;

      if (!userId) {
        currentUserId = null;
        setBalance(null);

        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }

        if (balanceInterval) {
          clearInterval(balanceInterval);
          balanceInterval = null;
        }

        return;
      }

      setupBalance(userId);
    });

    const initializeBalance = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      const userId = session?.user?.id || null;

      if (userId) {
        await setupBalance(userId);
      } else {
        setBalance(null);
      }
    };

    initializeBalance();

    return () => {
      isMounted = false;
      subscription.unsubscribe();

      if (balanceInterval) {
        clearInterval(balanceInterval);
      }

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setHasUnread(false);
    setBalance(null);
    setIsMenuOpen(false);
    router.push("/Client/Login/");
  };

  return (
    <>
      <header className="bg-[#184f35] px-4 py-4 flex items-center justify-between sticky top-0 z-50 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.3)] border-b-2 border-[#26352e]">

        <div className="flex items-center gap-3 min-w-0">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={`${siteName} Logo`}
              className="w-10 h-10 object-contain rounded-md shrink-0"
            />
          )}

          <div className="flex flex-col min-w-0">
            <div className="text-xl font-black text-white tracking-widest uppercase leading-tight drop-shadow-md truncate">
              {siteName || "Lotto Dhaka"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLoggedIn ? (
            <>
              {/* User Balance */}
              <div className="flex flex-col items-end justify-center bg-black/20 border border-white/10 rounded-lg px-2 py-1 min-w-0">
                <span className="text-[9px] text-white/70 font-semibold leading-tight">
                  {t("Balance", "ব্যালেন্স")}
                </span>

                <span className="text-xs sm:text-sm text-white font-bold tabular-nums whitespace-nowrap leading-tight">
                  {balance === null
                    ? "..."
                    : `৳ ${balance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </span>
              </div>

              {/* Notification */}
              <button
                onClick={() => router.push("/Notification")}
                className="relative p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition border border-white/10"
              >
                <Icons.Bell />

                {hasUnread && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/Client/Login/"
                className="border border-white text-white px-3 py-1.5 rounded-full text-[11px] font-bold hover:bg-white/10 transition"
              >
                {t("Login", "লগইন")}
              </Link>

              <Link
                href="/Client/Sign-up/"
                className="bg-white text-black px-3 py-1.5 rounded-full text-[11px] font-bold hover:opacity-90 transition"
              >
                {t("Signup", "সাইনআপ")}
              </Link>
            </div>
          )}

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white ml-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="absolute top-[64px] right-3 mt-1 w-64 bg-[#184f35] border border-[#26352e] rounded-xl shadow-2xl overflow-hidden py-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Reload Balance */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                router.push("/Client/Secure/Deposit-method/");
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-black/20 transition border-b border-[#26352e]"
            >
              <Icons.Money />
              <span className="text-[11px] font-semibold">
                {t("Reload Balance", "ব্যালেন্স রিলোড")}
              </span>
            </button>

            {isLoggedIn && (
              <>
                {/* Withdrawal */}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    router.push("/Client/Withdrawal/");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-black/20 transition border-b border-[#26352e]"
                >
                  <Icons.Document />
                  <span className="text-[11px] font-semibold">
                    {t("Withdrawal", "উত্তোলন")}
                  </span>
                </button>

                {/* Transactions */}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    router.push("/Client/Transactions/");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-black/20 transition border-b border-[#26352e]"
                >
                  <Icons.List />
                  <span className="text-[11px] font-semibold">
                    {t("Transactions", "লেনদেন")}
                  </span>
                </button>

                {/* Ticket Transactions */}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    router.push("/Client/Ticket-transactions/");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-black/20 transition border-b border-[#26352e]"
                >
                  <Icons.Ticket />
                  <span className="text-[11px] font-semibold">
                    {t("Ticket Transactions", "টিকিট লেনদেন")}
                  </span>
                </button>
              </>
            )}

            {/* Policy Condition */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                router.push("/policies/");
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-black/20 transition border-b border-[#26352e]"
            >
              <Icons.Document />
              <span className="text-[11px] font-semibold">
                {t("Policy Condition", "নীতিমালা ও শর্তাবলী")}
              </span>
            </button>

            {/* Support Center */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                router.push("/Support-center");
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-black/20 transition border-b border-[#26352e]"
            >
              <Icons.Support />
              <span className="text-[11px] font-semibold">
                {t("Support Center", "সাপোর্ট সেন্টার")}
              </span>
            </button>

            <div className="px-4 py-2 flex flex-col gap-2 border-b border-[#26352e]">
              <span className="text-[11px] text-white/70 font-semibold flex items-center gap-2">
                <Icons.Globe />
                {t("Language", "ভাষা")}
              </span>

              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setLanguage("BN")}
                  className={`flex-1 text-[11px] py-1.5 rounded border ${
                    language === "BN"
                      ? "border-white text-white"
                      : "border-white/20 text-white/70 hover:text-white"
                  }`}
                >
                  🇧🇩 বাংলা
                </button>

                <button
                  onClick={() => setLanguage("EN")}
                  className={`flex-1 text-[11px] py-1.5 rounded border ${
                    language === "EN"
                      ? "border-white text-white"
                      : "border-white/20 text-white/70 hover:text-white"
                  }`}
                >
                  🇺🇸 English
                </button>
              </div>
            </div>

            {isLoggedIn && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-[#ED4163] hover:bg-black/20 transition"
              >
                <Icons.Logout />
                <span className="text-[11px] font-semibold">
                  {t("Logout", "লগআউট")}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
