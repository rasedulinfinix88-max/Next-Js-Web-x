
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AdminMenuProps = {
  onLogout: () => void;
  loggingOut: boolean;
};

const ADMIN_PATH = "/admin-panel-rakib-aiman-tushar";

export default function AdminMenu({
  onLogout,
  loggingOut,
}: AdminMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  function goToDashboard() {
    setIsOpen(false);
    router.push(`${ADMIN_PATH}/User-dashboard/`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Admin Menu"
        aria-expanded={isOpen}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#315d45] bg-[#184f35] text-2xl text-white transition hover:bg-[#218653]"
      >
        ☰
      </button>

      {isOpen && (
        <button
          type="button"
          aria-label="Close Admin Menu"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/60"
        />
      )}

      <aside
        aria-label="Admin Navigation Menu"
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(85vw,360px)] flex-col border-l border-[#315d45] bg-[#10251a] shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#315d45] px-5 py-5">
          <div>
            <h2 className="text-lg font-bold text-green-400">
              ADMIN MENU
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              Administrator Navigation
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#193b29] text-xl text-white hover:bg-[#24543b]"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          <button
            type="button"
            onClick={goToDashboard}
            className="flex w-full items-center gap-3 rounded-xl bg-[#184f35] px-4 py-3 text-left font-semibold text-white transition hover:bg-[#218653]"
          >
            <span className="text-xl">▦</span>
            Dashboard
          </button>

          <div className="flex items-center justify-between rounded-xl border border-[#315d45] bg-[#09170f] px-4 py-3">
            <div className="flex items-center gap-3 text-gray-200">
              <span className="text-xl">👥</span>
              <span className="font-medium">User Management</span>
            </div>
            <span className="text-[10px] text-green-400">
              NEXT
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl px-4 py-3 text-gray-500">
            <div className="flex items-center gap-3">
              <span className="text-xl">💳</span>
              <span>Deposit Management</span>
            </div>
            <span className="text-[10px]">LATER</span>
          </div>

          <div className="flex items-center justify-between rounded-xl px-4 py-3 text-gray-500">
            <div className="flex items-center gap-3">
              <span className="text-xl">💸</span>
              <span>Withdrawal Management</span>
            </div>
            <span className="text-[10px]">LATER</span>
          </div>
        </nav>

        <div className="border-t border-[#315d45] p-4">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>↪</span>
            {loggingOut ? "Logging out..." : "Logout"}
          </button>

          <p className="mt-3 text-center text-[10px] text-gray-500">
            Authorized Administrators Only
          </p>
        </div>
      </aside>
    </>
  );
}
