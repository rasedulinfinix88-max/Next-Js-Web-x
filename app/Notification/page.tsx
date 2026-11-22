
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

type Notification = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  created_at: string;
  is_hidden: boolean;
};

export default function NotificationPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [readingId, setReadingId] = useState("");
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/user/login/");
      return;
    }

    setUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.account_status !== "active") {
      await supabase.auth.signOut();
      router.replace("/user/login/");
      return;
    }

    const { data: notificationData, error: notificationError } =
      await supabase
        .from("notifications")
        .select(
          "id, title, message, notification_type, created_at, is_hidden"
        )
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

    if (notificationError) {
      setError("Notification লোড করা যায়নি। আবার চেষ্টা করুন।");
      setLoading(false);
      return;
    }

    const { data: readData, error: readError } = await supabase
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", user.id);

    if (readError) {
      setError("Read Status লোড করা যায়নি। আবার চেষ্টা করুন।");
      setLoading(false);
      return;
    }

    setNotifications((notificationData || []) as Notification[]);
    setReadIds((readData || []).map((item) => item.notification_id));
    setError("");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const toggleMessage = (notificationId: string) => {
    setExpandedIds((previous) =>
      previous.includes(notificationId)
        ? previous.filter((id) => id !== notificationId)
        : [...previous, notificationId]
    );
  };

  const markAsRead = async (notificationId: string) => {
    if (!userId || readingId) return;
    if (readIds.includes(notificationId)) return;

    setReadingId(notificationId);

    const { error: insertError } = await supabase
      .from("notification_reads")
      .insert({
        notification_id: notificationId,
        user_id: userId,
      });

    if (insertError) {
      setError("পড়া হিসেবে সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।");
    } else {
      setReadIds((previous) =>
        previous.includes(notificationId)
          ? previous
          : [...previous, notificationId]
      );
      setError("");
    }

    setReadingId("");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07110d] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-9 h-9 border-4 border-[#24543b] border-t-green-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-300">
            Loading Notifications...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07110d] text-white">
      <header className="sticky top-0 z-40 border-b border-[#24543b] bg-[#10251a] px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">
              Notifications
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Your latest updates and announcements
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-[#326448] px-3 py-2 text-xs font-semibold text-green-300 hover:bg-[#183b29]"
          >
            Back
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-950/40 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#326448] bg-[#10251a] p-8 text-center">
            <div className="text-3xl mb-3">🔔</div>
            <h3 className="text-sm font-bold text-gray-200">
              No Notifications
            </h3>
            <p className="mt-2 text-xs text-gray-400">
              You don't have any notifications yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((item) => {
              const isRead = readIds.includes(item.id);
              const isReading = readingId === item.id;
              const isExpanded = expandedIds.includes(item.id);

              const words = item.message.trim().split(/\s+/).filter(Boolean);
              const hasMore = words.length > 5;

              const displayedMessage =
                isExpanded || !hasMore
                  ? item.message
                  : words.slice(0, 5).join(" ") + "...";

              return (
                <article
                  key={item.id}
                  className={`rounded-xl border p-4 transition ${
                    isRead
                      ? "border-[#24543b] bg-[#10251a]"
                      : "border-green-600/70 bg-[#122d1e]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white break-words">
                        {item.title}
                      </h3>
                    </div>

                    <span
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${
                        isRead
                          ? "bg-gray-800 text-gray-400"
                          : "bg-green-600/20 text-green-300"
                      }`}
                    >
                      {isRead ? "Read" : "New"}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-300">
                    {displayedMessage}
                  </p>

                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => toggleMessage(item.id)}
                      className="mt-2 text-xs font-bold text-green-400 hover:text-green-300"
                    >
                      {isExpanded ? "Less more" : "Read more"}
                    </button>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#24543b] pt-3">
                    <p className="text-[10px] text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </p>

                    {isRead ? (
                      <span className="text-xs text-green-400">
                        ✓ Already Read
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isReading || !!readingId}
                        onClick={() => markAsRead(item.id)}
                        className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isReading ? "Saving..." : "Mark as Read"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={loadNotifications}
            className="rounded-lg border border-[#326448] px-5 py-2.5 text-xs font-semibold text-green-300 hover:bg-[#183b29]"
          >
            Refresh Notifications
          </button>
        </div>
      </div>
    </main>
  );
}
