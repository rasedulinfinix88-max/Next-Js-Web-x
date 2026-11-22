
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

export default function JackpotManagementPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [testing, setTesting] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");

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

  async function testDrawList() {
    setTesting(true);
    setError("");
    setResponse("");

    try {
      const supabase = createClient();

      const { data: sessionData } =
        await supabase.auth.getSession();

      if (!sessionData.session?.access_token) {
        throw new Error(
          "Login session পাওয়া যায়নি। আবার Admin Login করুন।"
        );
      }

      const { data, error: functionError } =
        await supabase.functions.invoke(
          "jackpot-manager",
          {
            body: {
              action: "admin_list_draws"
            }
          }
        );

      if (functionError) {
        let details = functionError.message;

        const context = (
          functionError as { context?: unknown }
        ).context;

        if (context instanceof Response) {
          const body = await context.clone().text();

          details =
            `HTTP Status: ${context.status}\n` +
            `Status Text: ${context.statusText}\n\n` +
            `Backend Response:\n${body || functionError.message}`;
        }

        throw new Error(details);
      }

      setResponse(JSON.stringify(data, null, 2));

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "API পরীক্ষা ব্যর্থ হয়েছে।"
      );
    } finally {
      setTesting(false);
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
              Jackpot Management
            </p>
          </div>

          <AdminMenu
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-2xl border border-[#24543b] bg-[#10251a] p-5">
          <div className="text-3xl">🎰</div>

          <h2 className="mt-3 text-2xl font-bold text-green-400">
            Jackpot Management
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Jackpot Backend API Testing
          </p>

          <div className="mt-6 rounded-xl border border-[#24543b] bg-[#07110d] p-4">
            <h3 className="font-semibold">
              Draw List API Test
            </h3>

            <p className="mt-2 text-xs leading-6 text-gray-400">
              এই পরীক্ষার মাধ্যমে Backend থেকে Jackpot Draw
              List পাওয়া যাচ্ছে কি না যাচাই করা হবে।
              এতে কোনো Draw তৈরি বা পরিবর্তন হবে না।
            </p>

            <button
              type="button"
              onClick={testDrawList}
              disabled={testing}
              className="mt-5 w-full rounded-lg bg-green-600 px-4 py-3 font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testing
                ? "Testing API..."
                : "Test Jackpot Draw List"}
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-800 bg-red-950/30 p-4">
              <h3 className="font-semibold text-red-400">
                API Error Details
              </h3>

              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-xs leading-6 text-red-300">
                {error}
              </pre>
            </div>
          )}

          {response && (
            <div className="mt-5 rounded-xl border border-green-800 bg-green-950/20 p-4">
              <h3 className="font-semibold text-green-400">
                API Response
              </h3>

              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-xs leading-6 text-gray-200">
                {response}
              </pre>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
