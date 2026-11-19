
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";
import "./page.css";

type PaymentMethod = {
  id: string;
  method_code: string;
  method_name: string;
  method_type: string;
  account_name: string | null;
  admin_payment_number: string | null;
  wallet_address: string | null;
  network: string | null;
  method_logo_url: string | null;
  instructions: string | null;
  min_deposit: number | null;
  max_deposit: number | null;
  is_active: boolean;
};

type DepositResponse = {
  success: boolean;
  message?: string;
  deposit_enabled?: boolean;
  maintenance_message?: string;
  methods?: PaymentMethod[];
  deposit?: {
    id: string;
    deposit_tracking_id: string;
    payment_method_name: string;
    amount: number;
    status: string;
    created_at: string;
  };
};

export default function DepositMethodPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [balance, setBalance] = useState<number>(0);

  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethod | null>(null);

  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [senderAccount, setSenderAccount] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error" | "">("");

  const [trackingId, setTrackingId] = useState("");

  const showMessage = useCallback(
    (text: string, type: "success" | "error") => {
      setMessage(text);
      setMessageType(type);
    },
    []
  );

  const loadDepositData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("প্রথমে আপনার Account-এ Login করুন।");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw new Error("Account Balance লোড করা যায়নি।");
      }

      setBalance(Number(profile?.balance ?? 0));

      const { data, error } = await supabase.functions.invoke(
        "deposit-manager",
        {
          body: {
            action: "get_payment_methods",
          },
        }
      );

      if (error) {
        throw new Error(error.message || "Deposit Service সংযোগ করা যায়নি।");
      }

      const result = data as DepositResponse;

      if (!result?.success) {
        throw new Error(result?.message || "Payment Methods পাওয়া যায়নি।");
      }

      const activeMethods = (result.methods || []).filter(
        (method) => method.is_active
      );

      setMethods(activeMethods);
      setDepositEnabled(result.deposit_enabled === true);
      setMaintenanceMessage(result.maintenance_message || "");

      setSelectedMethod((previous) => {
        if (previous) {
          const sameMethod = activeMethods.find(
            (method) => method.id === previous.id
          );

          if (sameMethod) return sameMethod;
        }

        return activeMethods[0] || null;
      });
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, showMessage]);

  useEffect(() => {
    loadDepositData();
  }, [loadDepositData]);

  const paymentDetailsReady = useMemo(() => {
    if (!selectedMethod) return false;

    if (selectedMethod.method_type === "crypto") {
      return Boolean(selectedMethod.wallet_address?.trim());
    }

    return Boolean(selectedMethod.admin_payment_number?.trim());
  }, [selectedMethod]);

  const amountNumber = Number(amount);

  const amountValid =
    amount.trim() !== "" &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    (!selectedMethod?.min_deposit ||
      amountNumber >= Number(selectedMethod.min_deposit)) &&
    (!selectedMethod?.max_deposit ||
      amountNumber <= Number(selectedMethod.max_deposit));

  const canSubmit =
    depositEnabled &&
    paymentDetailsReady &&
    amountValid &&
    transactionId.trim().length >= 3 &&
    !submitting &&
    !loading;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setTrackingId("");

    if (!selectedMethod) {
      showMessage("একটি Payment Method নির্বাচন করুন।", "error");
      return;
    }

    if (!depositEnabled) {
      showMessage(
        maintenanceMessage || "Deposit Service বর্তমানে বন্ধ আছে।",
        "error"
      );
      return;
    }

    if (!paymentDetailsReady) {
      showMessage(
        "এই Payment Method-এর Receiving Details এখনো যুক্ত করা হয়নি।",
        "error"
      );
      return;
    }

    if (!amountValid) {
      showMessage("সঠিক Deposit Amount লিখুন।", "error");
      return;
    }

    if (transactionId.trim().length < 3) {
      showMessage("সঠিক Transaction ID লিখুন।", "error");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("আপনার Login Session পাওয়া যায়নি।");
      }

      const { data, error } = await supabase.functions.invoke(
        "deposit-manager",
        {
          body: {
            action: "create_deposit",
            payment_method_id: selectedMethod.id,
            amount: amountNumber,
            transaction_id: transactionId.trim(),
            sender_account: senderAccount.trim() || null,
          },
        }
      );

      if (error) {
        throw new Error(error.message || "Deposit Request পাঠানো যায়নি।");
      }

      const result = data as DepositResponse;

      if (!result?.success) {
        throw new Error(result?.message || "Deposit Request ব্যর্থ হয়েছে।");
      }

      setTrackingId(result.deposit?.deposit_tracking_id || "");
      setAmount("");
      setTransactionId("");
      setSenderAccount("");

      showMessage(
        result.message || "আপনার Deposit Request সফলভাবে জমা হয়েছে।",
        "success"
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Deposit Request পাঠাতে সমস্যা হয়েছে।",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copyPaymentDetails = async () => {
    if (!selectedMethod) return;

    const details =
      selectedMethod.method_type === "crypto"
        ? selectedMethod.wallet_address
        : selectedMethod.admin_payment_number;

    if (!details) return;

    try {
      await navigator.clipboard.writeText(details);
      showMessage("Payment Details Copy হয়েছে।", "success");
    } catch {
      showMessage("Copy করা যায়নি। নিজে Copy করুন।", "error");
    }
  };

  const paymentValue =
    selectedMethod?.method_type === "crypto"
      ? selectedMethod.wallet_address
      : selectedMethod?.admin_payment_number;

  if (loading) {
    return (
      <div className="secure-payment-page deposit-loading">
        <div className="deposit-loader" />
        <p>Deposit System লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="secure-payment-page">
      <main className="secure-main">
        <div className="deposit-page-heading">
          <h1>Deposit</h1>
          <p>আপনার Account-এ Balance যোগ করুন</p>
        </div>

        <section className="balance-info-card">
          <span>Available Balance</span>
          <h2>{balance.toLocaleString("en-US")}</h2>
        </section>

        {!depositEnabled && (
          <div className="msg-box error">
            {maintenanceMessage || "Deposit Service বর্তমানে বন্ধ আছে।"}
          </div>
        )}

        <section className="deposit-section">
          <h3 className="sec-title">Select Payment Method</h3>

          {methods.length === 0 ? (
            <div className="deposit-empty">
              বর্তমানে কোনো Payment Method Active নেই।
            </div>
          ) : (
            <div className="payment-grid">
              {methods.map((method) => (
                <button
                  type="button"
                  key={method.id}
                  className={`payment-option ${
                    selectedMethod?.id === method.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setSelectedMethod(method);
                    setMessage("");
                    setTrackingId("");
                  }}
                >
                  {method.method_logo_url ? (
                    <img
                      src={method.method_logo_url}
                      alt={method.method_name}
                    />
                  ) : (
                    <span className="payment-fallback">
                      {method.method_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}

                  <span>{method.method_name}</span>

                  {selectedMethod?.id === method.id && (
                    <span className="payment-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedMethod && (
          <>
            <section className="deposit-section">
              <h3 className="sec-title">Payment Details</h3>

              <div className="instruction-box">
                {selectedMethod.instructions && (
                  <p>{selectedMethod.instructions}</p>
                )}

                {selectedMethod.network && (
                  <p>Network: {selectedMethod.network}</p>
                )}

                {selectedMethod.account_name && (
                  <p>Account Name: {selectedMethod.account_name}</p>
                )}

                {paymentDetailsReady ? (
                  <div className="admin-number-container">
                    <span className="admin-number">{paymentValue}</span>

                    <button
                      type="button"
                      className="copy-btn-small"
                      onClick={copyPaymentDetails}
                    >
                      COPY
                    </button>
                  </div>
                ) : (
                  <p className="payment-not-configured">
                    এই Method-এর Receiving Details Admin এখনো Configure
                    করেননি।
                  </p>
                )}
              </div>
            </section>

            <form onSubmit={handleSubmit}>
              <section className="deposit-section">
                <h3 className="sec-title">Deposit Amount</h3>

                <input
                  className="custom-amount-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="Enter Amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />

                {(selectedMethod.min_deposit !== null ||
                  selectedMethod.max_deposit !== null) && (
                  <p className="deposit-limit">
                    {selectedMethod.min_deposit !== null &&
                      `Minimum: ${selectedMethod.min_deposit}`}
                    {selectedMethod.min_deposit !== null &&
                      selectedMethod.max_deposit !== null &&
                      " | "}
                    {selectedMethod.max_deposit !== null &&
                      `Maximum: ${selectedMethod.max_deposit}`}
                  </p>
                )}
              </section>

              <section className="deposit-section">
                <h3 className="sec-title">Sender Account / Wallet</h3>

                <input
                  className="trx-input"
                  type="text"
                  placeholder="Your payment account (optional)"
                  value={senderAccount}
                  onChange={(event) => setSenderAccount(event.target.value)}
                />
              </section>

              <section className="deposit-section">
                <h3 className="sec-title">Transaction ID</h3>

                <input
                  className="trx-input"
                  type="text"
                  placeholder="Enter Transaction ID"
                  value={transactionId}
                  onChange={(event) =>
                    setTransactionId(event.target.value.toUpperCase())
                  }
                  required
                  minLength={3}
                />
              </section>

              {message && (
                <div className={`msg-box ${messageType}`}>
                  {message}
                </div>
              )}

              {trackingId && (
                <div className="deposit-tracking-box">
                  <span>Deposit Tracking ID</span>
                  <strong>{trackingId}</strong>
                  <p>আপনার Request এখন Pending অবস্থায় আছে।</p>
                </div>
              )}

              <div className="deposit-submit-space" />

              <div className="submit-btn-wrapper">
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={!canSubmit}
                >
                  {submitting ? "Please Wait..." : "Submit Deposit"}
                </button>
              </div>
            </form>
          </>
        )}

        {!selectedMethod && methods.length === 0 && message && (
          <div className={`msg-box ${messageType}`}>{message}</div>
        )}
      </main>
    </div>
  );
}
