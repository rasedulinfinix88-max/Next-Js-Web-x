
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { useLanguage } from "../../../lib/LanguageContext";
import LotteryHeader from "../../../components/Header/Header";
import LotteryFooter from "../../../components/Footer/Footer";
import "./Secure-cashout-activity.css";

type PaymentMethod = {
  id: string;
  method_code: "bkash" | "nagad" | "bank" | "usdt";
  method_name: string;
  method_type: string;
  is_enabled: boolean;
  min_withdrawal: number;
  max_withdrawal: number;
  withdrawal_instructions?: string;
  maintenance_message?: string;
};

type WithdrawalAccount = {
  id: string;
  user_id: string;
  payment_method_code: string;
  account_holder_name?: string;
  account_number?: string;
  bank_name?: string;
  branch_name?: string;
  routing_number?: string;
  account_type?: string;
  wallet_address?: string;
  network?: string;
  is_default?: boolean;
  is_active?: boolean;
};

type WithdrawalHistory = {
  id: string;
  tracking_id: string;
  payment_method_code: string;
  payment_method_name: string;
  amount: number;
  status: string;
  created_at: string;
  admin_note?: string;
  rejection_reason?: string;
  withdrawal_account_snapshots?: any;
};

const bangladeshiBanks = [
  "Sonali Bank",
  "Janata Bank",
  "Agrani Bank",
  "Rupali Bank",
  "BRAC Bank",
  "Dutch-Bangla Bank",
  "Islami Bank",
  "City Bank",
  "Eastern Bank",
  "Pubali Bank",
  "IFIC Bank",
  "United Commercial Bank",
  "Beximco Bank",
  "One Bank",
  "Prime Bank",
  "Southeast Bank",
  "Bank Asia",
  "Standard Chartered",
  "HSBC",
  "First Security Islami Bank",
  "Union Bank",
  "Modhumoti Bank",
  "NRB Bank",
  "Meghna Bank",
  "Midland Bank",
  "Global Islami Bank",
  "Other Bank",
];

export default function WithdrawalPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<WithdrawalAccount[]>([]);
  const [history, setHistory] = useState<WithdrawalHistory[]>([]);

  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethod | null>(null);

  const [selectedAccount, setSelectedAccount] =
    useState<WithdrawalAccount | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const [amount, setAmount] = useState("");
  const [secretPin, setSecretPin] = useState("");

  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountType, setAccountType] = useState("savings");
  const [walletAddress, setWalletAddress] = useState("");
  const [network, setNetwork] = useState("");

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const notify = (type: string, text: string) => {
    setMessage({ type, text });
  };

  const getErrorMessage = (error: any) => {
    return (
      error?.context?.error ||
      error?.message ||
      t("Something went wrong.", "কিছু একটা সমস্যা হয়েছে।")
    );
  };

  const invokeFunction = async (body: any) => {
    const { data, error } = await supabase.functions.invoke(
      "withdrawal-manager",
      { body }
    );

    if (error) throw error;

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  };

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/Client/Login/");
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, user_mobile, lottery_id, balance, account_status"
      )
      .eq("id", user.id)
      .single();

    if (error || !data) {
      throw new Error(
        error?.message ||
          t("Profile not found.", "প্রোফাইল পাওয়া যায়নি।")
      );
    }

    if (data.account_status !== "active") {
      await supabase.auth.signOut();
      router.replace("/Client/Login/");
      return null;
    }

    setProfile(data);
    return data;
  }, [router, t]);

  const loadMethods = useCallback(async () => {
    const data = await invokeFunction({
      action: "get_methods",
    });

    setMethods(data.methods || []);
    setSettings(data.settings || null);

    const availableMethod = (data.methods || []).find(
      (method: PaymentMethod) => method.is_enabled
    );

    if (availableMethod) {
      setSelectedMethod((current) => {
        if (
          current &&
          (data.methods || []).some(
            (method: PaymentMethod) =>
              method.method_code === current.method_code &&
              method.is_enabled
          )
        ) {
          return current;
        }

        return availableMethod;
      });
    } else {
      setSelectedMethod(null);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    const data = await invokeFunction({
      action: "list_accounts",
    });

    setAccounts(data.accounts || []);
  }, []);

  const loadHistory = useCallback(async () => {
    const data = await invokeFunction({
      action: "my_history",
    });

    setHistory(data.history || []);
  }, []);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const userProfile = await loadProfile();

      if (!userProfile) return;

      const results = await Promise.allSettled([
        loadMethods(),
        loadAccounts(),
        loadHistory(),
      ]);

      const failed = results.find(
        (result) => result.status === "rejected"
      );

      if (failed && failed.status === "rejected") {
        throw failed.reason;
      }
    } catch (error: any) {
      notify("error", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [loadProfile, loadMethods, loadAccounts, loadHistory]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const resetAccountForm = () => {
    setSelectedAccount(null);
    setAccountHolder("");
    setAccountNumber("");
    setBankName("");
    setBranchName("");
    setRoutingNumber("");
    setAccountType("savings");
    setWalletAddress("");
    setNetwork("");
  };

  const editAccount = (account: WithdrawalAccount) => {
    setSelectedAccount(account);

    setAccountHolder(account.account_holder_name || "");
    setAccountNumber(account.account_number || "");
    setBankName(account.bank_name || "");
    setBranchName(account.branch_name || "");
    setRoutingNumber(account.routing_number || "");
    setAccountType(account.account_type || "savings");
    setWalletAddress(account.wallet_address || "");
    setNetwork(account.network || "");

    setShowAccountForm(true);
    setMessage({ type: "", text: "" });
  };

  const handleSaveAccount = async () => {
    if (!selectedMethod) return;

    if (
      selectedMethod.method_code === "bkash" ||
      selectedMethod.method_code === "nagad"
    ) {
      if (!accountHolder.trim() || !accountNumber.trim()) {
        notify(
          "error",
          t(
            "Please enter account holder name and account number.",
            "অ্যাকাউন্টের নাম ও নম্বর দিন।"
          )
        );
        return;
      }
    }

    if (selectedMethod.method_code === "bank") {
      if (
        !bankName ||
        !branchName.trim() ||
        !accountHolder.trim() ||
        !accountNumber.trim() ||
        !routingNumber.trim()
      ) {
        notify(
          "error",
          t(
            "Please fill all bank details.",
            "ব্যাংকের সব তথ্য পূরণ করুন।"
          )
        );
        return;
      }
    }

    if (selectedMethod.method_code === "usdt") {
      if (!walletAddress.trim() || !network.trim()) {
        notify(
          "error",
          t(
            "Please enter wallet address and network.",
            "ওয়ালেট অ্যাড্রেস ও নেটওয়ার্ক দিন।"
          )
        );
        return;
      }
    }

    setSavingAccount(true);
    setMessage({ type: "", text: "" });

    try {
      const existingDefault = accounts.some(
        (account) =>
          account.payment_method_code === selectedMethod.method_code &&
          account.is_default &&
          account.id !== selectedAccount?.id
      );

      const body = {
        action: "save_account",
        ...(selectedAccount ? { account_id: selectedAccount.id } : {}),
        payment_method_code: selectedMethod.method_code,
        account_holder_name: accountHolder.trim(),
        account_number: accountNumber.trim(),
        bank_name: bankName,
        branch_name: branchName.trim(),
        routing_number: routingNumber.trim(),
        account_type: accountType,
        wallet_address: walletAddress.trim(),
        network: network.trim(),
        is_default: selectedAccount
          ? Boolean(selectedAccount.is_default)
          : !existingDefault,
      };

      const data = await invokeFunction(body);

      notify(
        "success",
        data.message ||
          t("Account saved successfully.", "অ্যাকাউন্ট সংরক্ষণ হয়েছে।")
      );

      setShowAccountForm(false);
      resetAccountForm();

      await loadAccounts();
    } catch (error: any) {
      notify("error", getErrorMessage(error));
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    const confirmed = window.confirm(
      t(
        "Are you sure you want to delete this account?",
        "আপনি কি এই অ্যাকাউন্টটি মুছে ফেলতে চান?"
      )
    );

    if (!confirmed) return;

    try {
      setMessage({ type: "", text: "" });

      const data = await invokeFunction({
        action: "delete_account",
        account_id: accountId,
      });

      if (selectedAccount?.id === accountId) {
        resetAccountForm();
        setShowAccountForm(false);
      }

      notify(
        "success",
        data.message ||
          t("Account deleted.", "অ্যাকাউন্ট মুছে ফেলা হয়েছে।")
      );

      await loadAccounts();
    } catch (error: any) {
      notify("error", getErrorMessage(error));
    }
  };

  const handleWithdraw = async () => {
    if (!selectedMethod) {
      notify(
        "error",
        t("Select a payment method.", "পেমেন্ট পদ্ধতি নির্বাচন করুন।")
      );
      return;
    }

    if (!selectedAccount) {
      notify(
        "error",
        t("Select a saved account.", "সংরক্ষিত অ্যাকাউন্ট নির্বাচন করুন।")
      );
      return;
    }

    const withdrawAmount = Number(amount);

    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      notify(
        "error",
        t("Enter a valid amount.", "সঠিক পরিমাণ লিখুন।")
      );
      return;
    }

    if (withdrawAmount < Number(selectedMethod.min_withdrawal)) {
      notify(
        "error",
        `${t("Minimum withdrawal is", "সর্বনিম্ন উত্তোলন")} ৳${Number(
          selectedMethod.min_withdrawal
        ).toFixed(2)}`
      );
      return;
    }

    if (
      withdrawAmount > Number(selectedMethod.max_withdrawal)
    ) {
      notify(
        "error",
        `${t("Maximum withdrawal is", "সর্বোচ্চ উত্তোলন")} ৳${Number(
          selectedMethod.max_withdrawal
        ).toFixed(2)}`
      );
      return;
    }

    if (withdrawAmount > Number(profile?.balance || 0)) {
      notify(
        "error",
        t("Insufficient balance.", "আপনার ব্যালেন্স পর্যাপ্ত নয়।")
      );
      return;
    }

    if (!secretPin.trim()) {
      notify(
        "error",
        t("Enter your Secret PIN.", "আপনার সিক্রেট PIN দিন।")
      );
      return;
    }

    setSubmitting(true);
    setMessage({ type: "", text: "" });

    try {
      const data = await invokeFunction({
        action: "create_request",
        account_id: selectedAccount.id,
        amount: withdrawAmount,
        secret_pin: secretPin,
      });

      notify(
        "success",
        data.message ||
          t(
            "Withdrawal request submitted successfully.",
            "উইথড্র আবেদন সফলভাবে জমা হয়েছে।"
          )
      );

      setAmount("");
      setSecretPin("");
      setSelectedAccount(null);

      await Promise.all([
        loadProfile(),
        loadHistory(),
      ]);
    } catch (error: any) {
      notify("error", getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return "-";

    return new Date(date).toLocaleString(
      undefined,
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  };

  const methodAccounts = accounts.filter(
    (account) =>
      account.payment_method_code === selectedMethod?.method_code &&
      account.is_active !== false
  );

  const globalEnabled =
    settings?.is_withdrawal_enabled === true;

  const methodEnabled =
    selectedMethod?.is_enabled === true;

  const canWithdraw = globalEnabled && methodEnabled;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d241e] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white mt-4 font-bold tracking-widest text-[11px]">
          LOADING WITHDRAWAL...
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0d241e] flex items-center justify-center p-5">
        <p className="text-white text-sm">
          {t("Please login to continue.", "চালিয়ে যেতে লগইন করুন।")}
        </p>
      </div>
    );
  }

  return (
    <div className="cashout-page-wrapper">
      <div className="cashout-overlay">
        <LotteryHeader userProfile={profile} />

        <main className="cashout-main">
          {/* Balance */}
          <div className="balance-card">
            <span>
              {t("Available Balance", "বর্তমান ব্যালেন্স")}
            </span>

            <h2>
              ৳ {Number(profile.balance || 0).toFixed(2)}
            </h2>
          </div>

          {/* Global status */}
          {!globalEnabled && (
            <div className="msg-box error">
              {settings?.maintenance_message ||
                t(
                  "Withdrawal is currently unavailable.",
                  "বর্তমানে উইথড্র সেবা বন্ধ রয়েছে।"
                )}
            </div>
          )}

          {/* Payment Methods */}
          <div className="form-card">
            <h3 className="form-title">
              {t("Select Withdrawal Method", "উইথড্র পদ্ধতি নির্বাচন করুন")}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {methods.map((method) => {
                const active =
                  selectedMethod?.method_code === method.method_code;

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      if (!method.is_enabled) return;

                      setSelectedMethod(method);
                      setSelectedAccount(null);
                      setShowAccountForm(false);
                      resetAccountForm();
                      setMessage({ type: "", text: "" });
                    }}
                    disabled={!method.is_enabled}
                    className={`rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-white bg-[#184f35] shadow-lg"
                        : "border-[#2B4236] bg-[#0d241e]"
                    } ${
                      !method.is_enabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:border-white/60"
                    }`}
                  >
                    <div className="text-white font-extrabold text-sm">
                      {method.method_name}
                    </div>

                    <div className="text-[10px] mt-2 text-white/60">
                      {method.is_enabled
                        ? t("Available", "চালু")
                        : t("Disabled", "বন্ধ")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedMethod && (
            <>
              {/* Method information */}
              <div className="form-card">
                <h3 className="form-title">
                  {selectedMethod.method_name}{" "}
                  {t("Withdrawal", "উইথড্র")}
                </h3>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#0d241e] rounded-lg p-3">
                    <span className="text-[10px] text-[#A0ADB0]">
                      {t("Minimum", "সর্বনিম্ন")}
                    </span>
                    <p className="text-white font-bold text-sm mt-1">
                      ৳ {Number(selectedMethod.min_withdrawal).toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-[#0d241e] rounded-lg p-3">
                    <span className="text-[10px] text-[#A0ADB0]">
                      {t("Maximum", "সর্বোচ্চ")}
                    </span>
                    <p className="text-white font-bold text-sm mt-1">
                      ৳ {Number(selectedMethod.max_withdrawal).toFixed(2)}
                    </p>
                  </div>
                </div>

                {selectedMethod.withdrawal_instructions && (
                  <div className="text-xs text-[#A0ADB0] leading-6 whitespace-pre-wrap">
                    {selectedMethod.withdrawal_instructions}
                  </div>
                )}

                {!methodEnabled && (
                  <div className="msg-box error mt-3">
                    {selectedMethod.maintenance_message ||
                      t("This method is currently disabled.", "এই পদ্ধতিটি বর্তমানে বন্ধ।")}
                  </div>
                )}
              </div>

              {/* Saved Accounts */}
              <div className="form-card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="form-title mb-0">
                    {t("Saved Accounts", "সংরক্ষিত অ্যাকাউন্ট")}
                  </h3>

                  <button
                    type="button"
                    onClick={() => {
                      resetAccountForm();
                      setShowAccountForm(!showAccountForm);
                      setMessage({ type: "", text: "" });
                    }}
                    className="bg-[#184f35] border border-white/30 text-white rounded-lg px-3 py-2 text-[11px] font-bold"
                  >
                    {showAccountForm
                      ? t("Close", "বন্ধ")
                      : t("+ Add Account", "+ অ্যাকাউন্ট যোগ করুন")}
                  </button>
                </div>

                {methodAccounts.length === 0 && (
                  <p className="text-xs text-[#A0ADB0] text-center py-4">
                    {t(
                      "No saved account found.",
                      "কোনো সংরক্ষিত অ্যাকাউন্ট পাওয়া যায়নি।"
                    )}
                  </p>
                )}

                <div className="space-y-3">
                  {methodAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`rounded-lg border p-3 ${
                        selectedAccount?.id === account.id
                          ? "border-white bg-[#184f35]/40"
                          : "border-[#2B4236] bg-[#0d241e]"
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="withdrawal-account"
                          checked={selectedAccount?.id === account.id}
                          onChange={() => setSelectedAccount(account)}
                          className="mt-1 accent-white"
                        />

                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-bold break-all">
                            {account.account_holder_name ||
                              account.bank_name ||
                              account.network ||
                              selectedMethod.method_name}
                          </p>

                          {account.account_number && (
                            <p className="text-[#A0ADB0] text-xs mt-1">
                              {account.account_number}
                            </p>
                          )}

                          {account.wallet_address && (
                            <p className="text-[#A0ADB0] text-xs mt-1 break-all">
                              {account.wallet_address}
                            </p>
                          )}

                          {account.bank_name && (
                            <p className="text-[#A0ADB0] text-xs mt-1">
                              {account.bank_name} - {account.branch_name}
                            </p>
                          )}

                          {account.network && (
                            <p className="text-[#A0ADB0] text-xs mt-1">
                              {t("Network:", "নেটওয়ার্ক:")} {account.network}
                            </p>
                          )}

                          {account.is_default && (
                            <span className="text-[10px] text-green-400 font-bold mt-2 inline-block">
                              {t("Default Account", "ডিফল্ট অ্যাকাউন্ট")}
                            </span>
                          )}
                        </div>
                      </label>

                      <div className="flex justify-end gap-3 mt-3 border-t border-white/10 pt-2">
                        <button
                          type="button"
                          onClick={() => editAccount(account)}
                          className="text-[11px] text-white font-bold"
                        >
                          {t("Edit", "এডিট")}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(account.id)}
                          className="text-[11px] text-red-400 font-bold"
                        >
                          {t("Delete", "মুছুন")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Account Form */}
                {showAccountForm && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <h4 className="text-white font-bold text-sm mb-4">
                      {selectedAccount
                        ? t("Edit Account", "অ্যাকাউন্ট পরিবর্তন")
                        : t("Add New Account", "নতুন অ্যাকাউন্ট যোগ করুন")}
                    </h4>

                    {(selectedMethod.method_code === "bkash" ||
                      selectedMethod.method_code === "nagad") && (
                      <>
                        <div className="input-group">
                          <label>{t("Account Holder Name *", "অ্যাকাউন্টধারীর নাম *")}</label>
                          <input
                            className="input-field"
                            value={accountHolder}
                            onChange={(e) => setAccountHolder(e.target.value)}
                            placeholder="Account Holder Name"
                          />
                        </div>

                        <div className="input-group">
                          <label>{t("Account Number *", "অ্যাকাউন্ট নম্বর *")}</label>
                          <input
                            className="input-field"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="01XXXXXXXXX"
                            inputMode="numeric"
                          />
                        </div>
                      </>
                    )}

                    {selectedMethod.method_code === "bank" && (
                      <>
                        <div className="input-group">
                          <label>{t("Bank Name *", "ব্যাংকের নাম *")}</label>
                          <select
                            className="input-field"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                          >
                            <option value="">
                              {t("Select Bank", "ব্যাংক নির্বাচন করুন")}
                            </option>

                            {bangladeshiBanks.map((bank) => (
                              <option key={bank} value={bank}>
                                {bank}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="input-group">
                          <label>{t("Branch Name *", "শাখার নাম *")}</label>
                          <input
                            className="input-field"
                            value={branchName}
                            onChange={(e) => setBranchName(e.target.value)}
                            placeholder="Branch Name"
                          />
                        </div>

                        <div className="input-group">
                          <label>{t("Account Holder Name *", "অ্যাকাউন্টধারীর নাম *")}</label>
                          <input
                            className="input-field"
                            value={accountHolder}
                            onChange={(e) => setAccountHolder(e.target.value)}
                            placeholder="Account Holder Name"
                          />
                        </div>

                        <div className="input-group">
                          <label>{t("Account Number *", "অ্যাকাউন্ট নম্বর *")}</label>
                          <input
                            className="input-field"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="Account Number"
                          />
                        </div>

                        <div className="input-group">
                          <label>{t("Routing Number *", "রাউটিং নম্বর *")}</label>
                          <input
                            className="input-field"
                            value={routingNumber}
                            onChange={(e) => setRoutingNumber(e.target.value)}
                            placeholder="Routing Number"
                          />
                        </div>

                        <div className="input-group">
                          <label>{t("Account Type *", "অ্যাকাউন্টের ধরন *")}</label>
                          <select
                            className="input-field"
                            value={accountType}
                            onChange={(e) => setAccountType(e.target.value)}
                          >
                            <option value="savings">
                              {t("Savings", "সেভিংস")}
                            </option>
                            <option value="current">
                              {t("Current", "কারেন্ট")}
                            </option>
                          </select>
                        </div>
                      </>
                    )}

                    {selectedMethod.method_code === "usdt" && (
                      <>
                        <div className="input-group">
                          <label>{t("Wallet Address *", "ওয়ালেট অ্যাড্রেস *")}</label>
                          <textarea
                            className="input-field min-h-24 resize-y"
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            placeholder="Enter USDT wallet address"
                          />
                        </div>

                        <div className="input-group">
                          <label>{t("Network *", "নেটওয়ার্ক *")}</label>
                          <select
                            className="input-field"
                            value={network}
                            onChange={(e) => setNetwork(e.target.value)}
                          >
                            <option value="">
                              {t("Select Network", "নেটওয়ার্ক নির্বাচন করুন")}
                            </option>
                            <option value="TRC20">TRC20</option>
                            <option value="ERC20">ERC20</option>
                            <option value="BEP20">BEP20</option>
                          </select>
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveAccount}
                      disabled={savingAccount}
                      className="w-full bg-[#184f35] border border-white text-white rounded-lg py-3 text-sm font-bold disabled:opacity-50"
                    >
                      {savingAccount
                        ? t("Saving...", "সংরক্ষণ হচ্ছে...")
                        : t("Save Account", "অ্যাকাউন্ট সংরক্ষণ করুন")}
                    </button>
                  </div>
                )}
              </div>

              {/* Withdrawal Form */}
              <div className="form-card">
                <h3 className="form-title">
                  {t("Withdrawal Request", "উইথড্র আবেদন")}
                </h3>

                <div className="input-group">
                  <label>{t("Withdrawal Amount *", "উত্তোলনের পরিমাণ *")}</label>
                  <input
                    type="number"
                    className="input-field"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    min={selectedMethod.min_withdrawal}
                    max={selectedMethod.max_withdrawal}
                  />
                </div>

                <div className="input-group">
                  <label>{t("Secret PIN *", "সিক্রেট PIN *")}</label>
                  <input
                    type="password"
                    className="input-field"
                    value={secretPin}
                    onChange={(e) => setSecretPin(e.target.value)}
                    placeholder="Enter your Secret PIN"
                    autoComplete="off"
                  />
                </div>

                {!selectedAccount && (
                  <p className="text-xs text-yellow-400 mb-3">
                    {t(
                      "Please select a saved account first.",
                      "প্রথমে একটি সংরক্ষিত অ্যাকাউন্ট নির্বাচন করুন।"
                    )}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={
                    submitting ||
                    !canWithdraw ||
                    !selectedAccount ||
                    !amount ||
                    !secretPin
                  }
                  className="w-full bg-[#184f35] border border-white rounded-lg py-4 text-white text-sm font-extrabold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? t("Processing...", "প্রসেসিং...")
                    : t("Request Withdrawal", "উত্তোলনের আবেদন করুন")}
                </button>
              </div>
            </>
          )}

          {/* Message */}
          {message.text && (
            <div className={`msg-box ${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Withdrawal History */}
          <div className="form-card">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex justify-between items-center text-left"
            >
              <h3 className="form-title mb-0">
                {t("Withdrawal History", "উইথড্র হিস্টোরি")}
              </h3>

              <span className="text-white text-lg">
                {showHistory ? "−" : "+"}
              </span>
            </button>

            {showHistory && (
              <div className="mt-4 space-y-3">
                {history.length === 0 && (
                  <p className="text-center text-xs text-[#A0ADB0] py-4">
                    {t(
                      "No withdrawal history found.",
                      "কোনো উইথড্র হিস্টোরি পাওয়া যায়নি।"
                    )}
                  </p>
                )}

                {history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#0d241e] border border-[#2B4236] rounded-lg p-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-white text-xs font-bold">
                          {item.payment_method_name}
                        </p>

                        <p className="text-[#A0ADB0] text-[10px] mt-1 break-all">
                          {item.tracking_id}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold uppercase rounded px-2 py-1 ${
                          item.status === "approved"
                            ? "bg-green-500/20 text-green-400"
                            : item.status === "rejected"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="flex justify-between mt-3">
                      <span className="text-[#A0ADB0] text-xs">
                        {formatDate(item.created_at)}
                      </span>

                      <span className="text-white font-extrabold text-sm">
                        ৳ {Number(item.amount).toFixed(2)}
                      </span>
                    </div>

                    {item.rejection_reason && (
                      <p className="text-red-400 text-xs mt-3">
                        {t("Rejection Reason:", "বাতিলের কারণ:")}{" "}
                        {item.rejection_reason}
                      </p>
                    )}

                    {item.admin_note && (
                      <p className="text-[#A0ADB0] text-xs mt-2">
                        {t("Admin Note:", "অ্যাডমিন নোট:")}{" "}
                        {item.admin_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <LotteryFooter />
      </div>
    </div>
  );
}
