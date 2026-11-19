
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

const ADMIN_PATH = "/admin-panel-rakib-aiman-tushar";

type UserProfile = {
  id: string;
  full_name: string | null;
  user_mobile: string | null;
  user_email: string | null;
  lottery_id: string | null;
  account_status: string | null;
  user_role: string | null;
  user_birthday?: string | null;
  postal_code?: string | null;
  city_address?: string | null;
  user_address_store?: string | null;
  address_verified?: boolean | null;
  identification_verified?: boolean | null;
  user_lottery_fee_paid?: boolean | null;
  user_lottery_is_terms_accepted?: boolean | null;
  user_account_card_number?: string | null;
  balance: number | null;
  created_at: string | null;
  update_at: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export default function UserManagementPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    total_pages: 0,
  });
  const [selectedUser, setSelectedUser] =
    useState<UserProfile | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [adminRole, setAdminRole] = useState("");

  const fetchUsers = useCallback(
    async (nextPage = 1) => {
      setLoadingUsers(true);
      setError("");

      try {
        const { data, error: functionError } =
          await supabase.functions.invoke("admin-user-manager", {
            body: {
              action: "list_users",
              search,
              role,
              status,
              page: nextPage,
              limit: 25,
            },
          });

        if (functionError) {
          throw new Error(
            functionError.message || "Could not connect to User Manager"
          );
        }

        if (!data?.success) {
          throw new Error(data?.error || "Could not load users");
        }

        setUsers(data.users || []);
        setPagination(data.pagination);
        setPage(nextPage);
        setAdminRole(data.administrator_role || "");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setLoadingUsers(false);
      }
    },
    [search, role, status, supabase]
  );

  useEffect(() => {
    let active = true;

    async function initialize() {
      const access = await checkAdminAccess();

      if (!active) return;

      if (!access.allowed) {
        router.replace(`${ADMIN_PATH}/Admin-login/`);
        return;
      }

      setAdminRole(access.role || "");

      await fetchUsers(1);

      if (active) {
        setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [router, fetchUsers]);

  async function openUserDetails(userId: string) {
    setLoadingDetails(true);
    setSelectedUser(null);
    setError("");

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("admin-user-manager", {
          body: {
            action: "get_user",
            user_id: userId,
          },
        });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data?.success || !data.user) {
        throw new Error(data?.error || "Could not load user details");
      }

      setSelectedUser(data.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load profile"
      );
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await supabase.auth.signOut();
      router.replace(`${ADMIN_PATH}/Admin-login/`);
    } catch {
      setError("Logout failed. Please try again.");
      setLoggingOut(false);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07140d] text-white">
        <p>Loading User Management...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07140d] text-white">
      <header className="flex items-center justify-between border-b border-[#244632] bg-[#10251a] px-4 py-4">
        <div>
          <h1 className="text-lg font-bold text-green-400">
            USER MANAGEMENT
          </h1>
          <p className="text-xs text-gray-400">
            Administrator: {adminRole}
          </p>
        </div>

        <AdminMenu
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
      </header>

      <section className="mx-auto max-w-7xl space-y-5 p-4">
        <div>
          <h2 className="text-xl font-bold">User Management</h2>
          <p className="mt-1 text-sm text-gray-400">
            Search, filter and view registered accounts.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#244632] bg-[#10251a] p-4">
            <p className="text-xs text-gray-400">Total Users</p>
            <p className="mt-2 text-2xl font-bold">
              {pagination.total}
            </p>
          </div>

          <div className="rounded-xl border border-[#244632] bg-[#10251a] p-4">
            <p className="text-xs text-gray-400">Current Page</p>
            <p className="mt-2 text-2xl font-bold">{page}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[#244632] bg-[#10251a] p-4">
          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Search User
            </label>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchUsers(1);
              }}
              placeholder="Name, Mobile or Lottery ID"
              className="w-full rounded-lg border border-[#315d45] bg-[#09170f] px-3 py-3 text-sm text-white outline-none focus:border-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Role
              </label>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-[#315d45] bg-[#09170f] px-3 py-3 text-sm text-white"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Status
              </label>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-[#315d45] bg-[#09170f] px-3 py-3 text-sm text-white"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchUsers(1)}
            disabled={loadingUsers}
            className="w-full rounded-lg bg-[#218653] px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loadingUsers ? "Searching..." : "Search Users"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-[#244632] bg-[#10251a]">
          <div className="flex items-center justify-between border-b border-[#244632] p-4">
            <h3 className="font-semibold">Registered Accounts</h3>
            <span className="text-xs text-gray-400">
              {pagination.total} records
            </span>
          </div>

          {loadingUsers ? (
            <p className="p-5 text-center text-sm text-gray-400">
              Loading users...
            </p>
          ) : users.length === 0 ? (
            <p className="p-5 text-center text-sm text-gray-400">
              No users found.
            </p>
          ) : (
            <div className="divide-y divide-[#244632]">
              {users.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => openUserDetails(user.id)}
                  className="w-full p-4 text-left transition hover:bg-[#193b29]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {user.full_name || "Unnamed User"}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Lottery ID: {user.lottery_id || "—"}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mobile: {user.user_mobile || "—"}
                      </p>

                      <p className="mt-2 text-xs text-gray-300">
                        Balance: {user.balance ?? 0}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="rounded-md bg-[#193b29] px-2 py-1 text-[10px] text-green-300">
                        {user.user_role}
                      </span>

                      <p
                        className={`mt-2 text-xs ${
                          user.account_status === "active"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {user.account_status}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        View Details →
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1 || loadingUsers}
            onClick={() => fetchUsers(page - 1)}
            className="rounded-lg border border-[#315d45] px-4 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>

          <p className="text-xs text-gray-400">
            Page {pagination.page} of {pagination.total_pages || 1}
          </p>

          <button
            type="button"
            disabled={
              page >= pagination.total_pages || loadingUsers
            }
            onClick={() => fetchUsers(page + 1)}
            className="rounded-lg border border-[#315d45] px-4 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>

      {loadingDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="rounded-xl bg-[#10251a] p-5 text-white">
            Loading profile...
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/75 p-4">
          <div className="mx-auto my-6 max-w-xl rounded-2xl border border-[#315d45] bg-[#10251a]">
            <div className="flex items-center justify-between border-b border-[#315d45] p-4">
              <h2 className="font-bold text-green-400">
                USER PROFILE
              </h2>

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg bg-[#193b29] px-3 py-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 p-4">
              {[
                ["Full Name", selectedUser.full_name],
                ["Lottery ID", selectedUser.lottery_id],
                ["Mobile", selectedUser.user_mobile],
                ["Email", selectedUser.user_email],
                ["Role", selectedUser.user_role],
                ["Account Status", selectedUser.account_status],
                ["Birthday", selectedUser.user_birthday],
                ["Postal Code", selectedUser.postal_code],
                ["City Address", selectedUser.city_address],
                ["Full Address", selectedUser.user_address_store],
                ["Card Number", selectedUser.user_account_card_number],
                ["Balance", selectedUser.balance],
                ["Address Verified", selectedUser.address_verified],
                ["Identification Verified", selectedUser.identification_verified],
                ["Lottery Fee Paid", selectedUser.user_lottery_fee_paid],
                ["Terms Accepted", selectedUser.user_lottery_is_terms_accepted],
                ["Created At", formatDate(selectedUser.created_at)],
                ["Updated At", formatDate(selectedUser.update_at)],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex items-start justify-between gap-4 border-b border-[#244632] pb-2"
                >
                  <span className="text-xs text-gray-400">
                    {label}
                  </span>

                  <span className="max-w-[60%] break-words text-right text-sm">
                    {value === null || value === undefined || value === ""
                      ? "—"
                      : typeof value === "boolean"
                      ? value
                        ? "Yes"
                        : "No"
                      : String(value)}
                  </span>
                </div>
              ))}

              <p className="pt-2 text-xs text-gray-500">
                Password and Secret PIN are never displayed.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
