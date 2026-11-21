
"use client";

import { useSiteSettings } from "../../lib/SiteSettingsContext";

export default function MaintenancePage() {
  const {
    siteName,
    logoUrl,
    maintenanceMessage,
    isLoading,
  } = useSiteSettings();

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#07130e] text-white">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#07130e] px-5 py-10 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-[#24523b] bg-[#10251a] p-7 text-center shadow-2xl">

        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${siteName} Logo`}
            className="mx-auto mb-5 h-20 w-20 rounded-xl object-contain"
          />
        ) : (
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-xl bg-[#184f35] text-3xl font-bold">
            {siteName.charAt(0).toUpperCase()}
          </div>
        )}

        <h1 className="mb-6 text-2xl font-bold text-white">
          {siteName}
        </h1>

        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#184f35]/30 text-4xl">
          🔧
        </div>

        <h2 className="mb-4 text-xl font-bold text-[#75d69b]">
          ওয়েবসাইট রক্ষণাবেক্ষণ চলছে
        </h2>

        <p className="mb-7 whitespace-pre-wrap text-sm leading-7 text-gray-300">
          {maintenanceMessage}
        </p>

        <div className="mb-7 rounded-lg border border-[#24523b] bg-[#07130e] p-4">
          <p className="text-sm text-gray-400">
            আমরা শীঘ্রই আবার ফিরে আসব।
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full rounded-lg bg-[#184f35] px-5 py-3 font-semibold text-white transition hover:bg-[#226b48]"
        >
          আবার চেষ্টা করুন
        </button>

        <p className="mt-6 text-xs text-gray-500">
          Thank you for your patience.
        </p>
      </div>
    </main>
  );
}
