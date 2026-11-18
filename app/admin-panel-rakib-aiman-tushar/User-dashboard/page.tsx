
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

export default function AdminDashboardPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      const result = await checkAdminAccess();

      if (!active) return;

      if (!result.allowed) {
        router.replace(
          "/admin-panel-rakib-aiman-tushar/Admin-login/"
        );
        return;
      }

      setAdminAllowed(true);
      setChecking(false);
    }

    verifyAdmin();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const supabase = createClient();

      await supabase.auth.signOut();

      router.replace(
        "/admin-panel-rakib-aiman-tushar/Admin-login/"
      );
    } catch {
      setLoggingOut(false);
    }
  }

  if (checking || !adminAllowed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#07110d]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#24543b] border-t-green-500" />
          <p className="text-sm text-gray-300">
            Verifying Administrator...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07110d] text-white">
      <header className="border-b border-[#24543b] bg-[#10251a] px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-green-400">
              GAZICASINO ADMIN
            </h1>
            <p className="mt-1 text-xs text-gray-400">
              Secure Administration Dashboard
            </p>
          </div>

          <AdminMenu
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-2xl border border-[#24543b] bg-[#10251a] p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#184f35] text-3xl">
            👑
          </div>

          <h2 className="text-2xl font-bold">
            Welcome, Administrator!
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Your administrator account has been verified.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-green-800 bg-green-950/40 px-4 py-2 text-sm text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Admin Access Verified
          </div>
        </div>

        <div className="mt-8">
          <h3 className="mb-4 text-lg font-bold">
            Administration
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-[#24543b] bg-[#10251a] p-5">
              <div className="text-2xl">👥</div>
              <h4 className="mt-3 font-semibold">
                User Management
              </h4>
              <p className="mt-1 text-xs text-gray-400">
                Manage registered users
              </p>
              <p className="mt-3 text-xs text-green-400">
                Next Step
              </p>
            </div>

            <div className="rounded-xl border border-[#24543b] bg-[#10251a] p-5">
              <div className="text-2xl">💳</div>
              <h4 className="mt-3 font-semibold">
                Deposit Management
              </h4>
              <p className="mt-1 text-xs text-gray-400">
                Review deposit requests
              </p>
              <p className="mt-3 text-xs text-yellow-400">
                Coming later
              </p>
            </div>

            <div className="rounded-xl border border-[#24543b] bg-[#10251a] p-5">
              <div className="text-2xl">💸</div>
              <h4 className="mt-3 font-semibold">
                Withdrawal Management
              </h4>
              <p className="mt-1 text-xs text-gray-400">
                Review withdrawal requests
              </p>
              <p className="mt-3 text-xs text-yellow-400">
                Coming later
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
