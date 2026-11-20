
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import LotteryHeader from "../../components/Header/Header";
import LotteryFooter from "../../components/Footer/Footer";

export default function WithdrawTermsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/user/login");
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, user_mobile, lottery_id, balance, account_status, user_lottery_fee_paid, user_lottery_is_terms_accepted"
          )
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        if (data.account_status !== "active") {
          throw new Error("Your account is not active.");
        }

        if (mounted) {
          setProfile(data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Unable to load your account.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleContinue() {
    if (!isChecked || processing || !profile) return;

    setProcessing(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || user.id !== profile.id) {
        throw new Error("Your session has expired. Please login again.");
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          user_lottery_is_terms_accepted: true,
        })
        .eq("id", user.id)
        .select("user_lottery_fee_paid")
        .single();

      if (updateError) throw updateError;

      if (data.user_lottery_fee_paid === true) {
        router.push("/Client/Withdrawal");
      } else {
        router.push("/fee-payment");
      }
    } catch (err: any) {
      setError(
        err.message || "Unable to save your acceptance. Please try again."
      );
      setProcessing(false);
    }
  }

  const sectionStyle = {
    background: "#142d24",
    border: "1px solid #28513e",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "13px",
  };

  const headingStyle = {
    color: "#e9c879",
    fontSize: "15px",
    fontWeight: 700 as const,
    marginBottom: "9px",
  };

  const paragraphStyle = {
    color: "#d1ded6",
    fontSize: "13px",
    lineHeight: 1.8,
    margin: 0,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d241e",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <LotteryHeader userProfile={profile} />

      <main
        style={{
          width: "100%",
          maxWidth: "850px",
          margin: "0 auto",
          padding: "22px 14px 35px",
          flex: 1,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "#184f35",
            borderRadius: "12px",
            padding: "20px 15px",
            textAlign: "center",
            marginBottom: "18px",
          }}
        >
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 800,
              margin: "0 0 8px",
              color: "#ffffff",
            }}
          >
            Withdrawal Terms & Conditions
          </h1>

          <p
            style={{
              fontSize: "13px",
              color: "#d9e9de",
              margin: 0,
            }}
          >
            টাকা উত্তোলনের নিয়ম ও শর্তাবলি
          </p>
        </div>

        {loading ? (
          <div
            style={{
              padding: "50px 15px",
              textAlign: "center",
              color: "#c5d8cc",
            }}
          >
            Loading your account...
          </div>
        ) : (
          <>
            {profile && (
              <div
                style={{
                  ...sectionStyle,
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <div style={{ color: "#9fb8a8", fontSize: "12px" }}>
                    Account Holder
                  </div>
                  <div style={{ fontWeight: 700, marginTop: "4px" }}>
                    {profile.full_name || "User"}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#9fb8a8", fontSize: "12px" }}>
                    Lottery ID
                  </div>
                  <div style={{ fontWeight: 700, marginTop: "4px" }}>
                    {profile.lottery_id || "N/A"}
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                ...sectionStyle,
                maxHeight: "560px",
                overflowY: "auto",
              }}
            >
              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  1. Withdrawal Eligibility
                </h2>
                <p style={paragraphStyle}>
                  টাকা উত্তোলনের জন্য ব্যবহারকারীকে প্রয়োজনীয় Fee Payment,
                  পরিচয় যাচাই এবং Payment Method Verification সম্পন্ন করতে
                  হবে। Super Admin-এর চূড়ান্ত অনুমোদনের আগে Withdrawal
                  সুবিধা পাওয়া যাবে না।
                  <br />
                  <br />
                  Users must complete all required payment and verification
                  procedures and receive final Super Admin approval before
                  requesting a withdrawal.
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  2. Lottery Fee Categories
                </h2>
                <p style={paragraphStyle}>
                  Lottery Winning Amount-এর উপর প্রযোজ্য Fee নিচের ছয়টি
                  বিভাগে হিসাব করা হবে:
                </p>

                <ul
                  style={{
                    ...paragraphStyle,
                    paddingLeft: "22px",
                    marginTop: "10px",
                  }}
                >
                  <li>TICKET MANAGEMENT COST</li>
                  <li>NETWORK FEE</li>
                  <li>MANAGEMENT FEE</li>
                  <li>TEAM COST</li>
                  <li>FIELD COST</li>
                  <li>SERVICE FEE</li>
                </ul>

                <p style={paragraphStyle}>
                  প্রতিটি Fee-এর Percentage Super Admin নির্ধারণ করবেন।
                  <br />
                  <br />
                  The applicable percentage for each category is determined
                  by the authorized Super Admin.
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  3. Separate Fee Payment
                </h2>
                <p style={paragraphStyle}>
                  Lottery Fee Winning Amount থেকে কেটে নেওয়া হবে না।
                  ব্যবহারকারীকে Fee আলাদাভাবে পরিশোধ করতে হবে।
                  <br />
                  <br />
                  <strong style={{ color: "#e9c879" }}>
                    Your lottery winning balance will not be reduced by the
                    Lottery Fee. The fee must be paid separately.
                  </strong>
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  4. Payment Information
                </h2>
                <p style={paragraphStyle}>
                  Payment জমা দেওয়ার সময় সঠিক Payment Method, Sender
                  Account, Transaction ID এবং প্রয়োজনীয় Amount প্রদান করতে
                  হবে। ভুল, অসম্পূর্ণ, Duplicate অথবা যাচাই করা যায় না এমন
                  Payment তথ্য Reject হতে পারে।
                  <br />
                  <br />
                  Users must submit accurate payment details and a valid
                  transaction reference.
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  5. Identity Verification
                </h2>
                <p style={paragraphStyle}>
                  পরিচয় ও ঠিকানা যাচাইয়ের জন্য প্রয়োজনীয় তথ্য অথবা
                  Supporting Documents চাওয়া হতে পারে।
                  <br />
                  <br />
                  Users may be required to provide identity and address
                  information or supporting documents.
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  6. Withdrawal Method Verification
                </h2>
                <p style={paragraphStyle}>
                  ব্যবহারকারীর নির্বাচিত Withdrawal Account বা Payment
                  Method-এর মালিকানা এবং তথ্য যাচাই করা হবে।
                  <br />
                  <br />
                  Ownership and accuracy of the selected withdrawal method
                  must be verified before withdrawal access is granted.
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  7. Super Admin Approval
                </h2>
                <p style={paragraphStyle}>
                  Fee Payment এবং প্রয়োজনীয় Verification Super Admin
                  পর্যালোচনা করবেন। অনুমোদন না হওয়া পর্যন্ত Withdrawal
                  সুবিধা বন্ধ থাকবে।
                  <br />
                  <br />
                  <strong style={{ color: "#e9c879" }}>
                    UNDER REVIEW
                  </strong>
                  <br />
                  Approximately 24 Hours For Method Verification.
                  <br />
                  <br />
                  এটি একটি আনুমানিক সময়, নিশ্চিত Approval Deadline নয়।
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  8. Rejection and Resubmission
                </h2>
                <p style={paragraphStyle}>
                  Payment অথবা Verification Reject হলে প্রযোজ্য ক্ষেত্রে
                  কারণ জানানো হবে। ব্যবহারকারী ভুল সংশোধন করে পুনরায়
                  Submission করতে পারবেন।
                  <br />
                  <br />
                  Rejected submissions may be corrected and resubmitted
                  according to platform rules.
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  9. Accurate Information
                </h2>
                <p style={paragraphStyle}>
                  ব্যবহারকারীকে সঠিক ও সত্য ব্যক্তিগত এবং Payment তথ্য
                  প্রদান করতে হবে। মিথ্যা বা প্রতারণামূলক তথ্যের কারণে
                  Request Reject অথবা Account Restrict হতে পারে, প্রযোজ্য
                  আইন ও Platform Policy অনুযায়ী।
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  10. Withdrawal Conditions
                </h2>
                <p style={paragraphStyle}>
                  Withdrawal Request Account Status, Available Wallet
                  Balance, Withdrawal Limits, Payment Method Availability
                  এবং প্রয়োজনীয় Review-এর অধীন থাকবে।
                </p>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h2 style={headingStyle}>
                  11. Policy Updates
                </h2>
                <p style={paragraphStyle}>
                  প্রযোজ্য আইন মেনে প্রয়োজন অনুযায়ী Platform এই Terms
                  পরিবর্তন করতে পারে। গুরুত্বপূর্ণ পরিবর্তন কার্যকর হওয়ার
                  আগে ব্যবহারকারীদের জানানো হবে।
                </p>
              </section>

              <section>
                <h2 style={headingStyle}>
                  12. User Acceptance
                </h2>
                <p style={paragraphStyle}>
                  I AGREE & CONTINUE নির্বাচন করার মাধ্যমে ব্যবহারকারী
                  নিশ্চিত করছেন যে তিনি এই Withdrawal Terms & Conditions
                  পড়েছেন, বুঝেছেন এবং গ্রহণ করেছেন।
                  <br />
                  <br />
                  Terms গ্রহণ করলেই Fee Payment অথবা Withdrawal
                  স্বয়ংক্রিয়ভাবে অনুমোদিত হবে না।
                </p>
              </section>
            </div>

            <div
              style={{
                ...sectionStyle,
                background: "#10291f",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "11px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  style={{
                    width: "19px",
                    height: "19px",
                    marginTop: "3px",
                    accentColor: "#20a464",
                    flexShrink: 0,
                  }}
                />

                <span
                  style={{
                    color: "#ffffff",
                    fontSize: "13px",
                    lineHeight: 1.8,
                  }}
                >
                  আমি উপরের সব Withdrawal Terms & Conditions পড়েছি,
                  বুঝেছি এবং স্বেচ্ছায় সম্মতি প্রদান করছি।
                  <br />
                  <span style={{ color: "#a9c1b1" }}>
                    I have read, understood and agree to all the
                    Withdrawal Terms & Conditions.
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <div
                style={{
                  background: "#512323",
                  color: "#ffcccc",
                  border: "1px solid #8b4141",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  marginBottom: "14px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleContinue}
              disabled={!isChecked || processing || !profile}
              style={{
                width: "100%",
                padding: "15px",
                border: "none",
                borderRadius: "9px",
                background:
                  isChecked && !processing ? "#20a464" : "#456456",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: 800,
                cursor:
                  isChecked && !processing ? "pointer" : "not-allowed",
                opacity: isChecked && !processing ? 1 : 0.65,
              }}
            >
              {processing
                ? "Processing..."
                : "I AGREE & CONTINUE"}
            </button>

            <p
              style={{
                color: "#91aa9b",
                fontSize: "11px",
                textAlign: "center",
                lineHeight: 1.7,
                marginTop: "12px",
              }}
            >
              Your acceptance will be saved to your account.
              <br />
              আপনার সম্মতি আপনার Account-এ সংরক্ষণ করা হবে।
            </p>
          </>
        )}
      </main>

      <LotteryFooter />
    </div>
  );
}
