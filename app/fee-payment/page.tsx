
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import { useLanguage } from "../../lib/LanguageContext";
import LotteryHeader from "../../components/Header/Header";
import LotteryFooter from "../../components/Footer/Footer";

type FeeAssessment = {
  id: string;
  draw_id: string;
  winning_amount: number;
  fee_breakdown: Record<
    string,
    { fee_name: string; percentage: number; amount: number }
  >;
  total_fee_percentage: number;
  total_fee_amount: number;
  payment_status: string;
};

type PaymentMethod = {
  id: string;
  method_code: string;
  method_name: string | null;
  method_type: string | null;
  account_name: string | null;
  admin_payment_number: string | null;
  wallet_address: string | null;
  network: string | null;
  method_logo_url: string | null;
  instructions: string | null;
  maintenance_message: string | null;
  is_active: boolean | null;
  is_fee_payment_enabled: boolean;
};

type FeePayment = {
  id: string;
  status: string;
  submitted_amount: number;
  payment_method_code: string;
  sender_account: string;
  transaction_id: string;
  admin_note: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type Verification = {
  identity_status: string;
  payment_method_status: string;
  identity_note: string | null;
  payment_method_note: string | null;
};

export default function FeePaymentPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [profile, setProfile] = useState<any>(null);
  const [assessment, setAssessment] = useState<FeeAssessment | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [payment, setPayment] = useState<FeePayment | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);

  const [senderAccount, setSenderAccount] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const money = (value: number | string) =>
    Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const statusText = (status?: string) => {
    const value = (status || "pending").toLowerCase();

    const labels: Record<string, [string, string]> = {
      pending: ["Pending", "অপেক্ষমাণ"],
      unpaid: ["Unpaid", "পরিশোধ হয়নি"],
      under_review: ["Under Review", "পর্যালোচনাধীন"],
      approved: ["Approved", "অনুমোদিত"],
      rejected: ["Rejected", "বাতিল"],
    };

    const label = labels[value] || [value.replaceAll("_", " "), value];
    return t(label[0], label[1]);
  };

  const loadPage = async () => {
    const loadingStartedAt = Date.now();

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/user/login");
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, user_mobile, lottery_id, balance, account_status, user_lottery_fee_paid, user_lottery_is_terms_accepted"
        )
        .eq("id", user.id)
        .single();

      if (profileError || !userProfile) {
        throw new Error(profileError?.message || "Profile not found");
      }

      setProfile(userProfile);

      if (userProfile.account_status !== "active") {
        throw new Error(
          t(
            "Your account is not active. Please contact support.",
            "আপনার অ্যাকাউন্ট সক্রিয় নয়। Support-এর সঙ্গে যোগাযোগ করুন।"
          )
        );
      }

      if (userProfile.user_lottery_fee_paid === true) {
        router.replace("/Client/Withdrawal");
        return;
      }

      if (userProfile.user_lottery_is_terms_accepted !== true) {
        router.replace("/withdraw-terms");
        return;
      }

      // Load the latest published winning result.
      const { data: winningResult, error: resultError } = await supabase
        .from("ticket_draw_results")
        .select("draw_id")
        .eq("winner_user_id", user.id)
        .eq("result_status", "published")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (resultError) {
        throw new Error(resultError.message);
      }

      if (!winningResult?.draw_id) {
        throw new Error(
          t(
            "No published winning result was found for your account.",
            "আপনার অ্যাকাউন্টে কোনো Published Winning Result পাওয়া যায়নি।"
          )
        );
      }

      // Create or retrieve the existing fee assessment.
      const { data: assessmentData, error: assessmentError } =
        await supabase.rpc("user_create_lottery_fee_assessment", {
          p_draw_id: winningResult.draw_id,
        });

      if (assessmentError) {
        throw new Error(assessmentError.message);
      }

      if (!assessmentData) {
        throw new Error("Fee assessment could not be loaded.");
      }

      const currentAssessment = assessmentData as FeeAssessment;
      setAssessment(currentAssessment);

      // Load payment methods using the separate Fee Payment switch.
      const { data: methodData, error: methodError } = await supabase
        .from("control_payment_method")
        .select(
          "id, method_code, method_name, method_type, account_name, admin_payment_number, wallet_address, network, method_logo_url, instructions, maintenance_message, is_active, is_fee_payment_enabled"
        )
        .eq("is_active", true)
        .eq("is_fee_payment_enabled", true)
        .order("method_name", { ascending: true });

      if (methodError) {
        throw new Error(methodError.message);
      }

      const activeMethods = (methodData || []) as PaymentMethod[];
      setMethods(activeMethods);

      setSelectedMethod((previousMethod) => {
        if (
          previousMethod &&
          activeMethods.some(
            (method) => method.method_code === previousMethod
          )
        ) {
          return previousMethod;
        }

        return activeMethods[0]?.method_code || "";
      });

      // Load latest payment submission.
      const { data: paymentData, error: paymentError } = await supabase
        .from("lottery_fee_payments")
        .select("*")
        .eq("assessment_id", currentAssessment.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      setPayment(paymentData as FeePayment | null);

      // Load verification status.
      const { data: verificationData, error: verificationError } =
        await supabase
          .from("lottery_verification_requests")
          .select(
            "identity_status, payment_method_status, identity_note, payment_method_note"
          )
          .eq("assessment_id", currentAssessment.id)
          .eq("user_id", user.id)
          .maybeSingle();

      if (verificationError) {
        throw new Error(verificationError.message);
      }

      setVerification(verificationData as Verification | null);
    } catch (err: any) {
      setError(
        err?.message ||
          t("Something went wrong.", "কোনো একটি সমস্যা হয়েছে।")
      );
    } finally {
      // Keep the SVG loading animation visible for at least 2.9 seconds.
      const elapsed = Date.now() - loadingStartedAt;
      const remaining = Math.max(0, 2900 - elapsed);

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentMethod = methods.find(
    (method) => method.method_code === selectedMethod
  );

  const hasActivePayment =
    payment?.status === "pending" ||
    payment?.status === "under_review" ||
    payment?.status === "approved";

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!assessment) {
      setError(t("Fee assessment is missing.", "Fee Assessment পাওয়া যায়নি।"));
      return;
    }

    if (!selectedMethod) {
      setError(t("Please select a payment method.", "Payment Method নির্বাচন করুন।"));
      return;
    }

    if (!senderAccount.trim() || !transactionId.trim()) {
      setError(
        t(
          "Sender account and Transaction ID are required.",
          "Sender Account এবং Transaction ID দিতে হবে।"
        )
      );
      return;
    }

    if (hasActivePayment) {
      setError(
        t(
          "An active payment submission already exists.",
          "আপনার একটি Payment Submission ইতোমধ্যে Review-এ রয়েছে।"
        )
      );
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: submitError } = await supabase.rpc(
        "user_submit_lottery_fee_payment",
        {
          p_assessment_id: assessment.id,
          p_payment_method_code: selectedMethod,
          p_sender_account: senderAccount.trim(),
          p_transaction_id: transactionId.trim(),
          p_submitted_amount: Number(assessment.total_fee_amount),
        }
      );

      if (submitError) {
        throw new Error(submitError.message);
      }

      setPayment(data as FeePayment);
      setSenderAccount("");
      setTransactionId("");

      setSuccess(
        t(
          "Your payment has been submitted successfully. It is now under review.",
          "আপনার Payment সফলভাবে জমা হয়েছে। এটি এখন Review-এ রয়েছে।"
        )
      );

      await loadPage();
    } catch (err: any) {
      setError(
        err?.message ||
          t("Payment submission failed.", "Payment জমা দেওয়া যায়নি।")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "#173d2c",
    border: "1px solid #28553e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  };

  const mutedStyle: React.CSSProperties = {
    color: "#a9c2b2",
    fontSize: 13,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: "#102d20",
    color: "#ffffff",
    border: "1px solid #41644f",
    borderRadius: 8,
    padding: "13px 12px",
    fontSize: 14,
    outline: "none",
    marginTop: 7,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    color: "#e1eee5",
    fontSize: 13,
    fontWeight: 600,
    marginTop: 15,
  };

  const statusColor = (status?: string) => {
    if (status === "approved") return "#55d98a";
    if (status === "rejected") return "#ff7777";
    return "#f2c66d";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d2118",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <LotteryHeader userProfile={profile} />

      <main
        style={{
          width: "100%",
          maxWidth: 650,
          boxSizing: "border-box",
          padding: "22px 14px 40px",
          margin: "0 auto",
        }}
      >
        {loading ? (
          <div
            style={{
              minHeight: "65vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              textAlign: "center",
            }}
          >
            <svg
              width="92"
              height="92"
              viewBox="0 0 100 100"
              fill="none"
              role="img"
              aria-label="Loading"
            >
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="#28553e"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="#35d47b"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="185 264"
                style={{
                  transformOrigin: "50% 50%",
                  animation: "feeLoaderSpin 1.1s linear infinite",
                }}
              />
              <circle
                cx="50"
                cy="50"
                r="27"
                stroke="#41644f"
                strokeWidth="3"
                strokeDasharray="5 7"
                style={{
                  transformOrigin: "50% 50%",
                  animation: "feeLoaderReverse 2s linear infinite",
                }}
              />
              <path
                d="M39 51L47 59L63 41"
                stroke="#7af0a3"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 40,
                  strokeDashoffset: 40,
                  animation: "feeLoaderCheck 0.7s ease 0.3s forwards",
                }}
              />
            </svg>

            <div>
              <h2
                style={{
                  margin: "0 0 8px",
                  color: "#7af0a3",
                  fontSize: 19,
                }}
              >
                {t("Loading Fee Details", "Fee তথ্য লোড হচ্ছে")}
              </h2>
              <p style={{ ...mutedStyle, margin: 0 }}>
                {t(
                  "Please wait while we securely load your information.",
                  "আপনার তথ্য নিরাপদে লোড হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।"
                )}
              </p>
            </div>

            <style jsx>{`
              @keyframes feeLoaderSpin {
                from {
                  transform: rotate(0deg);
                }
                to {
                  transform: rotate(360deg);
                }
              }

              @keyframes feeLoaderReverse {
                from {
                  transform: rotate(0deg);
                }
                to {
                  transform: rotate(-360deg);
                }
              }

              @keyframes feeLoaderCheck {
                to {
                  stroke-dashoffset: 0;
                }
              }
            `}</style>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 23, margin: "0 0 7px", color: "#ffffff" }}>
                {t("Lottery Fee Payment", "লটারি ফি পেমেন্ট")}
              </h1>
              <p style={{ ...mutedStyle, margin: 0 }}>
                {t(
                  "Complete your fee payment and verification process.",
                  "আপনার Fee Payment এবং Verification প্রক্রিয়া সম্পন্ন করুন।"
                )}
              </p>
            </div>

            {error && !assessment && (
              <div
                style={{
                  ...cardStyle,
                  color: "#ffaaaa",
                  borderColor: "#8b4545",
                }}
              >
                {error}
                <button
                  type="button"
                  onClick={loadPage}
                  style={{
                    display: "block",
                    marginTop: 14,
                    padding: "10px 16px",
                    border: 0,
                    borderRadius: 7,
                    background: "#2b8151",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {t("Try Again", "আবার চেষ্টা করুন")}
                </button>
              </div>
            )}

            {assessment && (
              <>
                {error && (
                  <div
                    style={{
                      ...cardStyle,
                      color: "#ffaaaa",
                      borderColor: "#8b4545",
                    }}
                  >
                    {error}
                  </div>
                )}

                {success && (
                  <div
                    style={{
                      ...cardStyle,
                      color: "#8df0ae",
                      borderColor: "#367d50",
                    }}
                  >
                    {success}
                  </div>
                )}

                <section style={cardStyle}>
                  <h2 style={{ fontSize: 17, margin: "0 0 14px" }}>
                    {t("Winner Information", "বিজয়ীর তথ্য")}
                  </h2>

                  <div style={{ display: "grid", gap: 9 }}>
                    <div>
                      <span style={mutedStyle}>
                        {t("Full Name", "সম্পূর্ণ নাম")}
                      </span>
                      <div>{profile?.full_name || "—"}</div>
                    </div>

                    <div>
                      <span style={mutedStyle}>
                        {t("Lottery ID", "লটারি আইডি")}
                      </span>
                      <div>{profile?.lottery_id || "—"}</div>
                    </div>

                    <div>
                      <span style={mutedStyle}>
                        {t("Mobile Number", "মোবাইল নম্বর")}
                      </span>
                      <div>{profile?.user_mobile || "—"}</div>
                    </div>

                    <div>
                      <span style={mutedStyle}>
                        {t("Winning Amount", "জয়ের পরিমাণ")}
                      </span>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        ৳ {money(assessment.winning_amount)}
                      </div>
                    </div>
                  </div>
                </section>

                <section style={cardStyle}>
                  <h2 style={{ fontSize: 17, margin: "0 0 14px" }}>
                    {t("Fee Breakdown", "ফি-এর বিস্তারিত হিসাব")}
                  </h2>

                  {Object.entries(assessment.fee_breakdown || {}).map(
                    ([code, fee]) => (
                      <div
                        key={code}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 0",
                          borderBottom: "1px solid #315541",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13 }}>
                            {fee.fee_name || code}
                          </div>
                          <div style={mutedStyle}>
                            {Number(fee.percentage || 0)}%
                          </div>
                        </div>
                        <strong style={{ whiteSpace: "nowrap" }}>
                          ৳ {money(fee.amount)}
                        </strong>
                      </div>
                    )
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginTop: 16,
                      fontSize: 14,
                    }}
                  >
                    <span>{t("Total Fee Percentage", "মোট ফি-এর হার")}</span>
                    <strong>{assessment.total_fee_percentage}%</strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginTop: 12,
                      color: "#7af0a3",
                      fontSize: 18,
                    }}
                  >
                    <strong>{t("Total Fee Amount", "মোট ফি-এর পরিমাণ")}</strong>
                    <strong>৳ {money(assessment.total_fee_amount)}</strong>
                  </div>

                  <p style={{ ...mutedStyle, margin: "14px 0 0" }}>
                    {t(
                      "This fee is paid separately. It is not deducted from your lottery winning amount.",
                      "এই ফি আলাদাভাবে পরিশোধ করতে হবে। এটি আপনার Lottery Winning Amount থেকে কাটা হবে না।"
                    )}
                  </p>
                </section>

                <section style={cardStyle}>
                  <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>
                    {t("Verification Status", "ভেরিফিকেশন স্ট্যাটাস")}
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <span>{t("Identity Verification", "পরিচয় যাচাই")}</span>
                    <strong
                      style={{
                        color: statusColor(verification?.identity_status),
                      }}
                    >
                      {statusText(verification?.identity_status)}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span>
                      {t("Payment Method Verification", "পেমেন্ট মাধ্যম যাচাই")}
                    </span>
                    <strong
                      style={{
                        color: statusColor(
                          verification?.payment_method_status
                        ),
                      }}
                    >
                      {statusText(verification?.payment_method_status)}
                    </strong>
                  </div>

                  {verification?.identity_note && (
                    <p style={mutedStyle}>
                      {t("Identity Note", "পরিচয় সংক্রান্ত নোট")}:{" "}
                      {verification.identity_note}
                    </p>
                  )}

                  {verification?.payment_method_note && (
                    <p style={mutedStyle}>
                      {t("Payment Method Note", "পেমেন্ট মাধ্যমের নোট")}:{" "}
                      {verification.payment_method_note}
                    </p>
                  )}

                  <p style={{ ...mutedStyle, marginBottom: 0 }}>
                    {t(
                      "Your payment details and verification statuses will be reviewed by Super Admin.",
                      "আপনার Payment Details এবং Verification Status Super Admin পর্যালোচনা করবেন।"
                    )}
                  </p>
                </section>

                {payment?.status === "approved" && (
                  <section
                    style={{
                      ...cardStyle,
                      borderColor: "#367d50",
                      color: "#8df0ae",
                    }}
                  >
                    <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>
                      {t("Payment Approved", "পেমেন্ট অনুমোদিত")}
                    </h2>
                    {t(
                      "Your payment has been approved. Verification approval may still be required before withdrawal access is granted.",
                      "আপনার পেমেন্ট অনুমোদিত হয়েছে। Withdrawal Access পাওয়ার আগে Verification Approval প্রয়োজন হতে পারে।"
                    )}
                  </section>
                )}

                {payment?.status === "rejected" && (
                  <section
                    style={{
                      ...cardStyle,
                      borderColor: "#8b4545",
                      color: "#ffaaaa",
                    }}
                  >
                    <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>
                      {t("Payment Rejected", "পেমেন্ট বাতিল হয়েছে")}
                    </h2>
                    <p style={{ margin: 0 }}>
                      {payment.rejection_reason ||
                        t("No rejection reason provided.", "কোনো কারণ উল্লেখ করা হয়নি।")}
                    </p>
                    <p style={{ ...mutedStyle, marginBottom: 0 }}>
                      {t(
                        "You may submit a new payment after correcting the issue.",
                        "সমস্যা সংশোধন করে নতুন Payment জমা দিতে পারবেন।"
                      )}
                    </p>
                  </section>
                )}

                {payment?.status === "under_review" && (
                  <section
                    style={{
                      ...cardStyle,
                      borderColor: "#8b7139",
                      color: "#f2d58c",
                    }}
                  >
                    <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>
                      {t("UNDER REVIEW", "পর্যালোচনাধীন")}
                    </h2>
                    <p style={{ margin: "0 0 8px" }}>
                      {t(
                        "Approximately 24 Hours For Method Verification",
                        "পেমেন্ট মাধ্যম যাচাই করতে আনুমানিক ২৪ ঘণ্টা"
                      )}
                    </p>
                    <p style={{ ...mutedStyle, margin: 0 }}>
                      {t(
                        "Your payment and withdrawal method are being verified. Please wait for Super Admin approval.",
                        "আপনার Payment এবং Withdrawal Method যাচাই করা হচ্ছে। Super Admin-এর অনুমোদনের জন্য অপেক্ষা করুন।"
                      )}
                    </p>
                  </section>
                )}

                {!hasActivePayment && payment?.status !== "approved" && (
                  <section style={cardStyle}>
                    <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>
                      {t("Submit Fee Payment", "Fee Payment জমা দিন")}
                    </h2>

                    {methods.length === 0 ? (
                      <p style={{ color: "#f2c66d", fontSize: 14 }}>
                        {t(
                          "No active payment method is available right now.",
                          "এই মুহূর্তে কোনো Active Payment Method পাওয়া যাচ্ছে না।"
                        )}
                      </p>
                    ) : (
                      <form onSubmit={submitPayment}>
                        <label style={labelStyle}>
                          {t("Select Payment Method", "Payment Method নির্বাচন করুন")}
                        </label>

                        <select
                          value={selectedMethod}
                          onChange={(event) =>
                            setSelectedMethod(event.target.value)
                          }
                          style={inputStyle}
                          required
                        >
                          {methods.map((method) => (
                            <option
                              key={method.id}
                              value={method.method_code}
                            >
                              {method.method_name || method.method_code}
                            </option>
                          ))}
                        </select>

                        {currentMethod && (
                          <div
                            style={{
                              background: "#102d20",
                              border: "1px solid #41644f",
                              borderRadius: 9,
                              padding: 13,
                              marginTop: 13,
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: 9 }}>
                              {currentMethod.method_name ||
                                currentMethod.method_code}
                            </div>

                            {currentMethod.account_name && (
                              <p style={{ ...mutedStyle, margin: "6px 0" }}>
                                {t("Account Name", "অ্যাকাউন্টের নাম")}:{" "}
                                <strong style={{ color: "#fff" }}>
                                  {currentMethod.account_name}
                                </strong>
                              </p>
                            )}

                            {currentMethod.admin_payment_number && (
                              <p style={{ ...mutedStyle, margin: "6px 0" }}>
                                {t("Payment Number", "পেমেন্ট নম্বর")}:{" "}
                                <strong style={{ color: "#fff" }}>
                                  {currentMethod.admin_payment_number}
                                </strong>
                              </p>
                            )}

                            {currentMethod.wallet_address && (
                              <div style={{ marginTop: 8 }}>
                                <div style={mutedStyle}>
                                  {t("Wallet Address", "ওয়ালেট অ্যাড্রেস")}
                                </div>
                                <div
                                  style={{
                                    color: "#fff",
                                    fontSize: 13,
                                    wordBreak: "break-all",
                                  }}
                                >
                                  {currentMethod.wallet_address}
                                </div>
                              </div>
                            )}

                            {currentMethod.network && (
                              <p style={{ ...mutedStyle, margin: "8px 0" }}>
                                {t("Network", "নেটওয়ার্ক")}:{" "}
                                <strong style={{ color: "#fff" }}>
                                  {currentMethod.network}
                                </strong>
                              </p>
                            )}

                            {currentMethod.instructions && (
                              <p
                                style={{
                                  color: "#d5e6da",
                                  fontSize: 13,
                                  whiteSpace: "pre-wrap",
                                  marginBottom: 0,
                                }}
                              >
                                {currentMethod.instructions}
                              </p>
                            )}

                            {currentMethod.maintenance_message && (
                              <p
                                style={{
                                  color: "#f2c66d",
                                  fontSize: 13,
                                  marginBottom: 0,
                                }}
                              >
                                {currentMethod.maintenance_message}
                              </p>
                            )}
                          </div>
                        )}

                        <label style={labelStyle}>
                          {t("Fee Amount", "Fee-এর পরিমাণ")}
                        </label>
                        <input
                          type="text"
                          value={`৳ ${money(assessment.total_fee_amount)}`}
                          readOnly
                          style={{
                            ...inputStyle,
                            color: "#7af0a3",
                            fontWeight: 700,
                          }}
                        />

                        <label style={labelStyle}>
                          {t("Sender Account", "যে Account থেকে পাঠিয়েছেন")}
                        </label>
                        <input
                          type="text"
                          value={senderAccount}
                          onChange={(event) =>
                            setSenderAccount(event.target.value)
                          }
                          placeholder={t(
                            "Enter sender account number or wallet",
                            "Sender Account Number বা Wallet লিখুন"
                          )}
                          style={inputStyle}
                          required
                        />

                        <label style={labelStyle}>
                          {t("Transaction ID", "Transaction ID")}
                        </label>
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(event) =>
                            setTransactionId(event.target.value)
                          }
                          placeholder={t(
                            "Enter transaction ID",
                            "Transaction ID লিখুন"
                          )}
                          style={inputStyle}
                          required
                        />

                        <button
                          type="submit"
                          disabled={submitting || !currentMethod}
                          style={{
                            width: "100%",
                            marginTop: 20,
                            padding: 14,
                            border: 0,
                            borderRadius: 8,
                            background:
                              submitting || !currentMethod
                                ? "#53665a"
                                : "#21a45d",
                            color: "#fff",
                            fontSize: 15,
                            fontWeight: 700,
                            cursor:
                              submitting || !currentMethod
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {submitting
                            ? t("Submitting...", "জমা হচ্ছে...")
                            : t("Submit Payment", "Payment জমা দিন")}
                        </button>
                      </form>
                    )}
                  </section>
                )}

                <section
                  style={{
                    ...cardStyle,
                    borderColor: "#8b7139",
                    background: "#282719",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 8px",
                      fontSize: 15,
                      color: "#f2d58c",
                    }}
                  >
                    {t("Important Notice", "গুরুত্বপূর্ণ নোটিশ")}
                  </h3>
                  <p style={{ ...mutedStyle, margin: 0 }}>
                    {t(
                      "Withdrawal access will be available only after fee payment, identity verification, payment method verification and Super Admin approval.",
                      "Fee Payment, পরিচয় যাচাই, Payment Method Verification এবং Super Admin Approval সম্পন্ন হওয়ার পরই Withdrawal Access দেওয়া হবে।"
                    )}
                  </p>
                </section>
              </>
            )}
          </>
        )}
      </main>

      <LotteryFooter />
    </div>
  );
}
