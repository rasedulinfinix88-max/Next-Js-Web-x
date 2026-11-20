
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { checkAdminAccess } from "../../../lib/admin/admin-auth";
import AdminMenu from "../../../components/admin/AdminMenu";

type FeeSetting = {
  id: string;
  fee_code: string;
  fee_name: string;
  percentage: number;
  is_enabled: boolean;
  updated_at?: string;
};

const FEE_ORDER = [
  "ticket_management_cost",
  "network_fee",
  "management_fee",
  "team_cost",
  "field_cost",
  "service_fee",
];

const FEE_LABELS: Record<string, string> = {
  ticket_management_cost: "TICKET MANAGEMENT COST",
  network_fee: "NETWORK FEE",
  management_fee: "MANAGEMENT FEE",
  team_cost: "TEAM COST",
  field_cost: "FIELD COST",
  service_fee: "SERVICE FEE",
};

export default function UserFeeManagementPage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [fees, setFees] = useState<FeeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const access = await checkAdminAccess();

      if (!access.allowed) {
        router.replace("/");
        return;
      }

      if (access.role !== "super_admin") {
        router.replace("/");
        return;
      }

      const { data, error: feeError } = await supabase
        .from("lottery_fee_settings")
        .select(
          "id, fee_code, fee_name, percentage, is_enabled, updated_at"
        );

      if (feeError) throw feeError;

      const orderedFees = [...(data || [])]
        .sort((a, b) => {
          const aIndex = FEE_ORDER.indexOf(a.fee_code);
          const bIndex = FEE_ORDER.indexOf(b.fee_code);

          return (
            (aIndex === -1 ? 999 : aIndex) -
            (bIndex === -1 ? 999 : bIndex)
          );
        })
        .map((fee) => ({
          ...fee,
          percentage: Number(fee.percentage),
        }));

      setFees(orderedFees);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load fee settings."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const updateFee = (
    feeCode: string,
    changes: Partial<FeeSetting>
  ) => {
    setFees((current) =>
      current.map((fee) =>
        fee.fee_code === feeCode
          ? { ...fee, ...changes }
          : fee
      )
    );

    setError("");
    setSuccess("");
  };

  const saveFee = async (fee: FeeSetting) => {
    setError("");
    setSuccess("");

    if (
      !Number.isFinite(fee.percentage) ||
      fee.percentage < 0 ||
      fee.percentage > 100
    ) {
      setError("Percentage must be between 0 and 100.");
      return;
    }

    setSavingCode(fee.fee_code);

    try {
      const access = await checkAdminAccess();

      if (!access.allowed || access.role !== "super_admin") {
        router.replace("/");
        return;
      }

      const { data, error: rpcError } = await supabase.rpc(
        "admin_set_lottery_fee",
        {
          p_fee_code: fee.fee_code,
          p_percentage: fee.percentage,
          p_is_enabled: fee.is_enabled,
        }
      );

      if (rpcError) throw rpcError;

      if (!data) {
        throw new Error("Fee settings were not returned.");
      }

      const saved = Array.isArray(data) ? data[0] : data;

      setFees((current) =>
        current.map((item) =>
          item.fee_code === fee.fee_code
            ? {
                ...item,
                percentage: Number(saved.percentage),
                is_enabled: saved.is_enabled,
                updated_at: saved.updated_at,
              }
            : item
        )
      );

      setSuccess(
        `${fee.fee_name} saved successfully.`
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save fee settings."
      );
    } finally {
      setSavingCode(null);
    }
  };

  const totalEnabledPercentage = fees
    .filter((fee) => fee.is_enabled)
    .reduce(
      (total, fee) => total + Number(fee.percentage),
      0
    );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07110d] text-white flex items-center justify-center">
        Loading Fee Management...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07110d] text-white">
      <AdminMenu />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-sm text-emerald-400 font-semibold mb-2">
            SUPER ADMIN PANEL
          </p>

          <h1 className="text-2xl md:text-3xl font-bold">
            User Fee Management
          </h1>

          <p className="text-sm text-gray-400 mt-2">
            Manage all six lottery fee categories.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-700 bg-red-950/50 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-700 bg-emerald-950/50 p-4 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <div className="rounded-2xl border border-[#24513a] bg-[#10251b] p-4 mb-6">
          <p className="text-sm text-gray-400">
            Total Enabled Fee Percentage
          </p>

          <div className="text-3xl font-bold text-emerald-400 mt-2">
            {totalEnabledPercentage.toFixed(2)}%
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Only enabled fee categories are included.
          </p>
        </div>

        <div className="space-y-4">
          {fees.map((fee) => (
            <div
              key={fee.fee_code}
              className="rounded-2xl border border-[#254c38] bg-[#10251b] p-4 md:p-5"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-white text-sm md:text-base">
                    {FEE_LABELS[fee.fee_code] || fee.fee_name}
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    {fee.fee_code}
                  </p>
                </div>

                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    fee.is_enabled
                      ? "bg-emerald-900 text-emerald-300"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {fee.is_enabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Fee Percentage (%)
                </label>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={fee.percentage}
                    onChange={(e) =>
                      updateFee(fee.fee_code, {
                        percentage:
                          e.target.value === ""
                            ? 0
                            : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-[#315b43] bg-[#071810] px-4 py-3 pr-12 text-white outline-none focus:border-emerald-500"
                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">
                    %
                  </span>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl bg-[#091a11] border border-[#254c38] p-3 cursor-pointer">
                <span className="text-sm font-medium">
                  Enable this fee
                </span>

                <input
                  type="checkbox"
                  checked={fee.is_enabled}
                  onChange={(e) =>
                    updateFee(fee.fee_code, {
                      is_enabled: e.target.checked,
                    })
                  }
                  className="h-5 w-5 accent-emerald-500"
                />
              </label>

              <button
                type="button"
                onClick={() => saveFee(fee)}
                disabled={savingCode !== null}
                className="w-full mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 font-bold text-white transition"
              >
                {savingCode === fee.fee_code
                  ? "Saving..."
                  : "Save Fee Settings"}
              </button>
            </div>
          ))}
        </div>

        {fees.length === 0 && (
          <div className="rounded-xl bg-[#10251b] border border-[#254c38] p-5 text-center text-gray-400">
            No fee categories found.
          </div>
        )}

        <div className="mt-6 rounded-xl border border-yellow-800/60 bg-yellow-950/20 p-4">
          <p className="text-sm text-yellow-300 font-semibold">
            Important Notice
          </p>

          <p className="text-xs text-gray-400 mt-2 leading-6">
            Each fee category is saved separately. Changes are recorded
            in the existing fee audit log. A fee assessment uses the
            enabled rates when the assessment is created.
          </p>
        </div>
      </main>
    </div>
  );
}
