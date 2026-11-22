
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

const supabase = createClient();

type Notification = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  created_at: string;
};

export default function NotificationManagementPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");

  useEffect(() => {
    let mounted = true;

    const verifyAccess = async () => {
      try {
        await checkAdminAccess();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace(
            "/admin-panel-rakib-aiman-tushar/Admin-login/"
          );
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_role, account_status")
          .eq("id", user.id)
          .single();

        if (
          profileError ||
          !profile ||
          profile.user_role !== "super_admin" ||
          profile.account_status !== "active"
        ) {
          router.replace(
            "/admin-panel-rakib-aiman-tushar/Admin-login/"
          );
          return;
        }

        if (mounted) {
          await loadNotifications();
          setLoading(false);
        }
      } catch {
        router.replace(
          "/admin-panel-rakib-aiman-tushar/Admin-login/"
        );
      }
    };

    verifyAccess();

    return () => {
      mounted = false;
    };
  }, [router]);

  const loadNotifications = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, notification_type, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setNotice("Notification তালিকা লোড করা যায়নি।");
      setNoticeType("error");
      return;
    }

    setNotifications((data || []) as Notification[]);
  };

  const handlePublish = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle || !cleanMessage) {
      setNotice("Title এবং Message দুটোই লিখুন।");
      setNoticeType("error");
      return;
    }

    setPublishing(true);
    setNotice("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("আপনার Admin Session পাওয়া যায়নি।");
      }

      const { error } = await supabase
        .from("notifications")
        .insert({
          title: cleanTitle,
          message: cleanMessage,
          notification_type: "general",
          created_by: user.id,
        });

      if (error) {
        throw error;
      }

      setTitle("");
      setMessage("");

      await loadNotifications();

      setNotice("Notification সফলভাবে Publish হয়েছে।");
      setNoticeType("success");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Notification Publish করা যায়নি।";

      setNotice(errorMessage);
      setNoticeType("error");
    } finally {
      setPublishing(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);

    await supabase.auth.signOut();

    router.replace(
      "/admin-panel-rakib-aiman-tushar/Admin-login/"
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07110d] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-9 h-9 border-4 border-[#24543b] border-t-green-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-300">
            Verifying Super Admin Access...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07110d] text-white">
      <header className="border-b border-[#24543b] bg-[#10251a] px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-wide">
              GAZICASINO <span className="text-green-400">ADMIN</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Notification Management
            </p>
          </div>

          <AdminMenu
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        <section className="rounded-xl border border-[#24543b] bg-[#10251a] p-4">
          <div className="mb-4">
            <h2 className="text-base font-bold text-green-400">
              Create Notification
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Write and publish a notification for all active users.
            </p>
          </div>

          <form onSubmit={handlePublish} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Notification Title
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter notification title"
                maxLength={150}
                required
                className="w-full rounded-lg border border-[#326448] bg-[#07110d] px-3 py-3 text-sm text-white outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Notification Message
              </label>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your notification message..."
                rows={5}
                maxLength={5000}
                required
                className="w-full resize-y rounded-lg border border-[#326448] bg-[#07110d] px-3 py-3 text-sm text-white outline-none focus:border-green-500"
              />
              <p className="text-right text-[10px] text-gray-500 mt-1">
                {message.length}/5000
              </p>
            </div>

            {notice && (
              <div
                className={`rounded-lg border px-3 py-3 text-xs ${
                  noticeType === "success"
                    ? "border-green-700 bg-green-950/40 text-green-300"
                    : "border-red-700 bg-red-950/40 text-red-300"
                }`}
              >
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={publishing}
              className="w-full rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition"
            >
              {publishing ? "Publishing..." : "Publish Notification"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-[#24543b] bg-[#10251a] p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold">
                Published Notifications
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Total: {notifications.length}
              </p>
            </div>

            <button
              type="button"
              onClick={loadNotifications}
              className="rounded-lg border border-[#326448] px-3 py-2 text-xs text-green-300 hover:bg-[#183b29]"
            >
              Refresh
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#326448] p-6 text-center">
              <p className="text-sm text-gray-400">
                No notifications published yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-[#326448] bg-[#07110d] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-bold text-green-300">
                      {item.title}
                    </h3>

                    <span className="shrink-0 rounded bg-green-950 px-2 py-1 text-[10px] text-green-300">
                      Published
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-gray-300">
                    {item.message}
                  </p>

                  <div className="mt-3 border-t border-[#24543b] pt-2">
                    <p className="text-[10px] text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
