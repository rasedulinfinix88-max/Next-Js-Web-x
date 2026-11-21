
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { useSiteSettings } from "../../../lib/SiteSettingsContext";

export default function MaintenanceAdminPage() {
  const router = useRouter();

  const {
    siteName,
    logoUrl,
    maintenanceMode,
    maintenanceMessage,
    isLoading,
  } = useSiteSettings();

  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [message, setMessage] = useState("");

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
          router.replace("/Client/Login/");
          return;
        }

        const userId = sessionData.session.user.id;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_role, account_status")
          .eq("id", userId)
          .maybeSingle();

        if (
          profileError ||
          !profile ||
          profile.account_status !== "active" ||
          !["admin", "super_admin"].includes(profile.user_role)
        ) {
          router.replace("/");
          return;
        }

        if (active) {
          setAuthorized(true);
          setChecking(false);
        }
      } catch {
        router.replace("/");
      }
    }

    verifyAdmin();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (isLoading) return;

    setName(siteName || "");
    setLogo(logoUrl || "");
    setMaintenance(maintenanceMode);
    setMessage(maintenanceMessage || "");
  }, [
    isLoading,
    siteName,
    logoUrl,
    maintenanceMode,
    maintenanceMessage,
  ]);

  async function saveSettings() {
    setSaving(true);
    setNotice("");
    setError("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error("আপনার Login Session পাওয়া যায়নি।");
      }

      const cleanName = name.trim();
      const cleanLogo = logo.trim();

      if (!cleanName) {
        throw new Error("Website Name লিখুন।");
      }

      if (
        cleanLogo &&
        (!cleanLogo.startsWith("https://") ||
          !URL.canParse(cleanLogo))
      ) {
        throw new Error("Logo URL অবশ্যই সঠিক HTTPS URL হতে হবে।");
      }

      const { data, error: functionError } =
        await supabase.functions.invoke("site-manager", {
          body: {
            action: "update_settings",
            site_name: cleanName,
            logo_url: cleanLogo || null,
            maintenance_mode: maintenance,
            maintenance_message: message,
          },
        });

      if (functionError) {
        throw new Error(
          functionError.message || "Settings Save করা যায়নি।"
        );
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setNotice("Settings সফলভাবে Save হয়েছে!");

      window.setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "একটি অজানা সমস্যা হয়েছে।"
      );
    } finally {
      setSaving(false);
    }
  }

  if (checking || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#07130e] text-white">
        Dashboard Loading...
      </main>
    );
  }

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-[#07130e] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl">

        <aside className="hidden w-64 shrink-0 border-r border-[#234532] bg-[#0b1b12] p-6 md:block">
          <h1 className="mb-2 text-xl font-bold text-[#75d69b]">
            LOTTO DHAKA
          </h1>

          <p className="mb-10 text-xs text-gray-500">
            ADMIN CONTROL CENTER
          </p>

          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Main Menu
          </p>

          <div className="rounded-lg bg-[#184f35] px-4 py-3 font-semibold">
            <span>⚙️</span> Website Settings
          </div>

          <div className="mt-3 rounded-lg px-4 py-3 text-gray-400">
            🛠️ Maintenance
          </div>

          <div className="mt-3 rounded-lg px-4 py-3 text-gray-500">
            🔒 Security
            <span className="ml-2 text-xs">Coming Soon</span>
          </div>

          <div className="mt-3 rounded-lg px-4 py-3 text-gray-500">
            👥 User Management
            <span className="ml-2 text-xs">Coming Soon</span>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-4 sm:p-7 lg:p-10">

          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#75d69b]">
                Administration
              </p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                Control Dashboard
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Manage your website settings and maintenance.
              </p>
            </div>

            <button
              onClick={() => router.push("/")}
              className="rounded-lg border border-[#315440] px-4 py-2 text-sm text-gray-300 hover:bg-[#153522]"
            >
              View Website ↗
            </button>
          </header>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

            <div className="rounded-xl border border-[#234532] bg-[#10251a] p-5">
              <p className="text-sm text-gray-400">Website Name</p>
              <h3 className="mt-3 text-xl font-bold">
                {name || "Not Set"}
              </h3>
              <p className="mt-2 text-xs text-gray-500">
                Current Website Identity
              </p>
            </div>

            <div className="rounded-xl border border-[#234532] bg-[#10251a] p-5">
              <p className="text-sm text-gray-400">Website Status</p>
              <h3 className={`mt-3 text-xl font-bold ${
                maintenance ? "text-yellow-400" : "text-green-400"
              }`}>
                {maintenance ? "Maintenance ON" : "Online"}
              </h3>
              <p className="mt-2 text-xs text-gray-500">
                Current Maintenance Status
              </p>
            </div>

            <div className="rounded-xl border border-[#234532] bg-[#10251a] p-5">
              <p className="text-sm text-gray-400">Logo Status</p>
              <h3 className="mt-3 text-xl font-bold">
                {logo ? "Logo Configured" : "No Logo"}
              </h3>
              <p className="mt-2 text-xs text-gray-500">
                Website Branding
              </p>
            </div>

          </div>

          <div className="space-y-6">

            <div className="rounded-xl border border-[#234532] bg-[#10251a] p-5 sm:p-7">
              <div className="mb-6">
                <h3 className="text-lg font-bold">
                  General Website Settings
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  Configure your website identity.
                </p>
              </div>

              <label className="mb-2 block text-sm font-medium">
                Website Name
              </label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Enter Website Name"
                className="mb-6 w-full rounded-lg border border-[#315440] bg-[#07130e] px-4 py-3 text-white outline-none focus:border-[#75d69b]"
              />

              <label className="mb-2 block text-sm font-medium">
                Logo URL (HTTPS)
              </label>

              <input
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-lg border border-[#315440] bg-[#07130e] px-4 py-3 text-white outline-none focus:border-[#75d69b]"
              />

              <div className="mt-5 rounded-lg border border-[#315440] bg-[#07130e] p-4">
                <p className="mb-3 text-xs text-gray-400">
                  LOGO PREVIEW
                </p>

                {logo ? (
                  <img
                    src={logo}
                    alt="Website Logo Preview"
                    className="h-20 w-20 rounded-lg object-contain"
                  />
                ) : (
                  <p className="text-sm text-gray-500">
                    No Logo URL Provided
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#234532] bg-[#10251a] p-5 sm:p-7">
              <div className="mb-6">
                <h3 className="text-lg font-bold">
                  Maintenance Control
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  Control public website availability.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#315440] bg-[#07130e] p-4">
                <div>
                  <p className="font-semibold">
                    Maintenance Mode
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {maintenance
                      ? "Website Maintenance is enabled"
                      : "Website is available to users"}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={maintenance}
                  onClick={() => setMaintenance(!maintenance)}
                  className={`relative h-8 w-14 rounded-full transition ${
                    maintenance ? "bg-yellow-500" : "bg-[#315440]"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                      maintenance ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <label className="mb-2 mt-6 block text-sm font-medium">
                Maintenance Message
              </label>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Write Maintenance Message..."
                className="w-full resize-y rounded-lg border border-[#315440] bg-[#07130e] px-4 py-3 text-white outline-none focus:border-[#75d69b]"
              />

              <p className="mt-2 text-right text-xs text-gray-500">
                {message.length}/2000
              </p>
            </div>

            {notice && (
              <div className="rounded-lg border border-green-700 bg-green-900/30 p-4 text-sm text-green-300">
                ✓ {notice}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-700 bg-red-900/30 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#234532] bg-[#10251a] p-5">
              <div>
                <p className="font-semibold">Save Changes</p>
                <p className="mt-1 text-xs text-gray-400">
                  Save your settings to Supabase.
                </p>
              </div>

              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="rounded-lg bg-[#21834e] px-7 py-3 font-bold text-white transition hover:bg-[#2aa461] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>

          </div>

          <footer className="mt-10 border-t border-[#234532] pt-5 text-center text-xs text-gray-500">
            Lotto Dhaka Admin Control Center
          </footer>

        </section>
      </div>
    </main>
  );
}
