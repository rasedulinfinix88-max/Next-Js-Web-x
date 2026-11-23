
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";
import { useLanguage } from "../../../../lib/LanguageContext";
import Header from "../../../../components/Header/Header";
import Footer from "../../../../components/Footer/Footer";
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
  error?: string;
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

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const functionError = error as {
    message?: string;
    context?: Response;
  };

  const context = functionError?.context;

  if (context && typeof context.clone === "function") {
    try {
      const body = await context.clone().json();

      if (typeof body?.error === "string") {
        return body.error;
      }

      if (typeof body?.message === "string") {
        return body.message;
      }
    } catch {
      // Use the original error message when the response is not readable.
    }
  }

  return functionError?.message || "Request failed";
}

export default function DepositMethodPage() {
  const supabase = useMemo(() => createClient(), []);
  const { language, t } = useLanguage();

  const translate = useCallback(
    (en: string, bn: string) => t(en, bn),
    [language]
  );

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

  // Loading animation states
  const [loadingStage, setLoadingStage] = useState<
    "preparing" | "verifying" | "success" | "cash"
  >("preparing");

  const [introComplete, setIntroComplete] = useState(false);
  const [cashAnimationDone, setCashAnimationDone] = useState(false);

  // First 5.8 seconds: payment verification messages
  useEffect(() => {
    const verifyTimer = window.setTimeout(() => {
      setLoadingStage("verifying");
    }, 2000);

    const successTimer = window.setTimeout(() => {
      setLoadingStage("success");
    }, 3700);

    const introTimer = window.setTimeout(() => {
      setIntroComplete(true);
    }, 5800);

    return () => {
      window.clearTimeout(verifyTimer);
      window.clearTimeout(successTimer);
      window.clearTimeout(introTimer);
    };
  }, []);

  // Show the Cash SVG only after both the intro and Supabase loading finish
  useEffect(() => {
    if (!introComplete || loading) return;

    setLoadingStage("cash");

    const cashTimer = window.setTimeout(() => {
      setCashAnimationDone(true);
    }, 1000);

    return () => {
      window.clearTimeout(cashTimer);
    };
  }, [introComplete, loading]);

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
        throw new Error(
          translate("Please login to your account first.", "প্রথমে আপনার Account-এ Login করুন।")
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw new Error(
          translate("Could not load account balance.", "Account Balance লোড করা যায়নি।")
        );
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
        const serverMessage = await getFunctionErrorMessage(error);

        throw new Error(
          serverMessage === "Request failed"
            ? translate("Could not connect to deposit service.", "Deposit Service সংযোগ করা যায়নি।")
            : serverMessage
        );
      }

      const result = data as DepositResponse;

      if (!result?.success) {
        throw new Error(
          result?.error ||
            result?.message ||
            translate("Payment methods not found.", "Payment Methods পাওয়া যায়নি।")
        );
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
          : translate("Something went wrong. Please try again.", "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, showMessage, translate]);

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

  const transactionIdValid = transactionId.trim().length >= 6;

  const canSubmit =
    depositEnabled &&
    paymentDetailsReady &&
    amountValid &&
    transactionIdValid &&
    !submitting &&
    !loading;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setTrackingId("");

    if (!selectedMethod) {
      showMessage(
        translate("Please select a payment method.", "একটি Payment Method নির্বাচন করুন।"),
        "error"
      );
      return;
    }

    if (!depositEnabled) {
      showMessage(
        maintenanceMessage ||
          translate("Deposit service is currently disabled.", "Deposit Service বর্তমানে বন্ধ আছে।"),
        "error"
      );
      return;
    }

    if (!paymentDetailsReady) {
      showMessage(
        translate(
          "Receiving details for this payment method are not configured yet.",
          "এই Payment Method-এর Receiving Details এখনো যুক্ত করা হয়নি।"
        ),
        "error"
      );
      return;
    }

    if (!amountValid) {
      showMessage(
        translate("Please enter a valid deposit amount.", "সঠিক Deposit Amount লিখুন।"),
        "error"
      );
      return;
    }

    if (!transactionIdValid) {
      showMessage(
        translate(
          "Transaction ID must be at least 6 characters.",
          "Transaction ID কমপক্ষে ৬ অক্ষর বা সংখ্যা হতে হবে।"
        ),
        "error"
      );
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          translate("Your login session was not found.", "আপনার Login Session পাওয়া যায়নি।")
        );
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
        const serverMessage = await getFunctionErrorMessage(error);

        if (
          serverMessage ===
          "This transaction ID has already been used"
        ) {
          throw new Error(
            translate(
              "This Transaction ID has already been used. Please enter a different Transaction ID.",
              "এই Transaction ID আগে ব্যবহার করা হয়েছে। অনুগ্রহ করে অন্য Transaction ID দিন।"
            )
          );
        }

        if (
          serverMessage ===
          "Transaction ID must be 3 to 120 characters"
        ) {
          throw new Error(
            translate(
              "Invalid Transaction ID. It must contain 6 to 120 characters.",
              "Transaction ID সঠিক নয়। এতে ৬ থেকে ১২০টি অক্ষর বা সংখ্যা থাকতে হবে।"
            )
          );
        }

        throw new Error(
          serverMessage === "Request failed"
            ? translate("Could not submit deposit request.", "Deposit Request পাঠানো যায়নি।")
            : serverMessage
        );
      }

      const result = data as DepositResponse;

      if (!result?.success) {
        throw new Error(
          result?.error ||
            result?.message ||
            translate("Deposit request failed.", "Deposit Request ব্যর্থ হয়েছে।")
        );
      }

      setTrackingId(result.deposit?.deposit_tracking_id || "");
      setAmount("");
      setTransactionId("");
      setSenderAccount("");

      showMessage(
        result.message ||
          translate(
            "Your deposit request has been submitted successfully.",
            "আপনার Deposit Request সফলভাবে জমা হয়েছে।"
          ),
        "success"
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : translate("Could not submit deposit request.", "Deposit Request পাঠাতে সমস্যা হয়েছে।"),
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
      showMessage(
        translate("Payment details copied.", "Payment Details Copy হয়েছে।"),
        "success"
      );
    } catch {
      showMessage(
        translate("Could not copy. Please copy manually.", "Copy করা যায়নি। নিজে Copy করুন।"),
        "error"
      );
    }
  };

  const paymentValue =
    selectedMethod?.method_type === "crypto"
      ? selectedMethod.wallet_address
      : selectedMethod?.admin_payment_number;

  // Loading screen: intro + Supabase data + Cash SVG animation
  if (loading || !introComplete || !cashAnimationDone) {
    return (
      <div className="secure-payment-page">
        <Header />

        <main className="deposit-loading-content">
          {loadingStage === "cash" ? (
            <div className="cash-animation-wrap">
              <svg
                className="cash-based-svg"
                viewBox="0 0 120 100"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="Cash payment"
              >
                <rect
                  className="cash-note"
                  x="12"
                  y="25"
                  width="96"
                  height="58"
                  rx="7"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                />

                <path
                  d="M22 25c0 8-3 12-10 12M98 25c0 8 3 12 10 12M22 83c0-8-3-12-10-12M98 83c0-8 3-12 10-12"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                <circle
                  className="cash-coin"
                  cx="60"
                  cy="54"
                  r="19"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                />

                <path
                  d="M66 46c-2-4-11-5-13 0-3 7 12 5 12 12 0 6-9 8-15 3M60 40v28"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                <path
                  className="cash-spark"
                  d="M60 7v8M43 12l4 6M77 12l-4 6"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          ) : (
            <div className="deposit-verification-content">
              <div className="deposit-loader" />

              <p key={loadingStage} className="deposit-loading-text">
                {loadingStage === "preparing" &&
                  "preparing payment method"}

                {loadingStage === "verifying" &&
                  "Verify Payment Network"}

                {loadingStage === "success" &&
                  "Verification Successfully"}
              </p>
            </div>
          )}
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="secure-payment-page">
      <Header />

      <main className="secure-main">
        {!depositEnabled && (
          <div className="msg-box error">
            {maintenanceMessage ||
              translate("Deposit service is currently disabled.", "Deposit Service বর্তমানে বন্ধ আছে।")}
          </div>
        )}

        <section className="deposit-section">
          <h3 className="sec-title">
            {translate("Select Payment Method", "Payment Method নির্বাচন করুন")}
          </h3>

          {methods.length === 0 ? (
            <div className="deposit-empty">
              {translate(
                "No payment methods are currently active.",
                "বর্তমানে কোনো Payment Method Active নেই।"
              )}
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
              <h3 className="sec-title">
                {translate("Payment Details", "Payment Details")}
              </h3>

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
                      {translate("COPY", "কপি")}
                    </button>
                  </div>
                ) : (
                  <p className="payment-not-configured">
                    {translate(
                      "Receiving details for this method have not been configured by Admin.",
                      "এই Method-এর Receiving Details Admin এখনো Configure করেননি।"
                    )}
                  </p>
                )}
              </div>
            </section>

            <form onSubmit={handleSubmit} className="deposit-form-card">
              <section className="deposit-form-field">
                <h3 className="sec-title">
                  {translate("Deposit Amount", "Deposit Amount")}
                </h3>

                <p className="deposit-limit">
                  {translate("Minimum", "সর্বনিম্ন")}: 20
                  <span>|</span>
                  {translate("Maximum", "সর্বোচ্চ")}: 10000
                </p>

                <div className="quick-amount-grid">
                  {[20, 100, 500, 1000, 5000].map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={`quick-amount-btn ${
                        amount === String(value) ? "active" : ""
                      }`}
                      onClick={() => setAmount(String(value))}
                    >
                      {value.toLocaleString("en-US")}
                    </button>
                  ))}
                </div>

                <input
                  className="custom-amount-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder={translate("Enter Amount", "পরিমাণ লিখুন")}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </section>

              <section className="deposit-form-field">
                <h3 className="sec-title">
                  {translate("Sender Account / Wallet", "প্রেরকের Account / Wallet")}
                </h3>

                <input
                  className="trx-input"
                  type="text"
                  placeholder={translate("Optional", "ঐচ্ছিক")}
                  value={senderAccount}
                  onChange={(event) => setSenderAccount(event.target.value)}
                />
              </section>

              <section className="deposit-form-field">
                <h3 className="sec-title">
                  {translate("Transaction ID", "Transaction ID")}
                </h3>

                <input
                  className="trx-input"
                  type="text"
                  placeholder={translate("Enter Transaction ID", "Transaction ID লিখুন")}
                  value={transactionId}
                  onChange={(event) =>
                    setTransactionId(
                      event.target.value
                        .replace(/[\u0980-\u09FF]/g, "")
                        .toUpperCase()
                    )
                  }
                  required
                  minLength={6}
                  autoComplete="off"
                />

                <p className="transaction-hint">
                  {translate(
                    "Minimum 6 characters or numbers",
                    "কমপক্ষে ৬টি অক্ষর বা সংখ্যা"
                  )}
                </p>
              </section>

              {message && (
                <div className={`msg-box ${messageType}`}>
                  {message}
                </div>
              )}

              {trackingId && (
                <div className="deposit-tracking-box">
                  <span>{translate("Deposit Tracking ID", "Deposit Tracking ID")}</span>
                  <strong>{trackingId}</strong>
                  <p>
                    {translate(
                      "Your request is currently pending.",
                      "আপনার Request এখন Pending অবস্থায় আছে।"
                    )}
                  </p>
                </div>
              )}

              <div className="submit-btn-wrapper">
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={!canSubmit}
                >
                  {submitting
                    ? translate("Please Wait...", "অপেক্ষা করুন...")
                    : translate("Submit Deposit", "Deposit জমা দিন")}
                </button>
              </div>
            </form>
          </>
        )}

        {!selectedMethod && methods.length === 0 && message && (
          <div className={`msg-box ${messageType}`}>{message}</div>
        )}
      </main>

      <Footer />
    </div>
  );
}
