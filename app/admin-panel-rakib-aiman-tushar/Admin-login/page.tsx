
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";

export default function AdminLoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      // Login through existing auth-manager
      const { data, error: functionError } =
        await supabase.functions.invoke("auth-manager", {
          body: {
            action: "login",
            identifier: identifier.trim(),
            password,
          },
        });

      if (functionError) {
        throw new Error("Login request failed. Please try again.");
      }

      if (!data?.session) {
        throw new Error(data?.error || "Login failed.");
      }

      // Save Supabase Auth session in browser
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        throw sessionError;
      }

      // Verify Admin role
      const adminCheck = await checkAdminAccess();

      if (!adminCheck.allowed) {
        await supabase.auth.signOut();

        throw new Error(
          "Access denied. Only active administrators can enter."
        );
      }

      // Admin verified
      router.replace(
        "/admin-panel-rakib-aiman-tushar/User-dashboard/"
      );
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#07110d] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[#24543b] bg-[#10251a] p-6 shadow-2xl">

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#184f35] text-3xl">
            🔐
          </div>

          <h1 className="text-2xl font-bold text-white">
            Admin Login
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            Secure Administrator Access
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">
              Lottery ID / Mobile Number
            </label>

            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter Lottery ID or Mobile"
              required
              autoComplete="username"
              className="w-full rounded-xl border border-[#315d45] bg-[#09170f] px-4 py-3 text-white outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#315d45] bg-[#09170f] px-4 py-3 text-white outline-none focus:border-green-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#1b7547] py-3 font-bold text-white transition hover:bg-[#218653] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Verifying Admin..." : "Secure Admin Login"}
          </button>

        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Authorized Administrators Only
        </p>
      </div>
    </main>
  );
}
