
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import LotteryHeader from "../../../../components/Header/Header";
import LotteryFooter from "../../../../components/Footer/Footer";

type Profile = {
  id: string;
  full_name: string | null;
  user_mobile: string | null;
  lottery_id: string | null;
  account_status: string | null;
  user_role: string | null;
  user_birthday: string | null;
  postal_code: string | null;
  city_address: string | null;
  user_address_store: string | null;
  address_verified: boolean | null;
  identification_verified: boolean | null;
  user_lottery_fee_paid: boolean | null;
  user_lottery_is_terms_accepted: boolean | null;
  balance: number | string | null;
  created_at: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 15px",
  borderRadius: "12px",
  background: "#101c18",
  border: "1px solid #34483e",
  color: "#ffffff",
  outline: "none",
  fontSize: "14px",
  transition: "border-color .2s ease",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#9eafa6",
  fontSize: "12px",
  fontWeight: 600,
  marginBottom: "8px",
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [cityAddress, setCityAddress] = useState("");
  const [fullAddress, setFullAddress] = useState("");

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [passwordBusy, setPasswordBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function fillForm(data: Profile) {
    setFullName(data.full_name || "");
    setBirthday(data.user_birthday || "");
    setPostalCode(data.postal_code || "");
    setCityAddress(data.city_address || "");
    setFullAddress(data.user_address_store || "");
  }

  useEffect(() => {
    let mounted = true;
    const startedAt = Date.now();

    async function loadProfile() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace("/user/login/");
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id,full_name,user_mobile,lottery_id,account_status,user_role,user_birthday,postal_code,city_address,user_address_store,address_verified,identification_verified,user_lottery_fee_paid,user_lottery_is_terms_accepted,balance,created_at"
          )
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;
        if (!data) throw new Error("Profile not found.");

        if (mounted) {
          setProfile(data as Profile);
          fillForm(data as Profile);
        }
      } catch (err) {
        console.error("Profile loading error:", err);
        if (mounted) {
          setPageError(
            err instanceof Error
              ? err.message
              : "Profile could not be loaded."
          );
        }
      } finally {
        const remaining = Math.max(0, 3100 - (Date.now() - startedAt));

        window.setTimeout(() => {
          if (mounted) setLoading(false);
        }, remaining);
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [supabase, router]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!fullName.trim()) {
        throw new Error("Full name is required.");
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData.user) {
        throw new Error("Please log in again.");
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          user_birthday: birthday || null,
          postal_code: postalCode.trim() || null,
          city_address: cityAddress.trim() || null,
          user_address_store: fullAddress.trim() || null,
          update_at: new Date().toISOString(),
        })
        .eq("id", authData.user.id)
        .select("id");

      if (updateError) {
        console.error("Profile update database error:", updateError);
        throw new Error(
          `Database update error: ${updateError.message} (Code: ${updateError.code || "unknown"})`
        );
      }

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "No profile row was updated. Please check your UPDATE policy and profile ID."
        );
      }

      const { data: updated, error: refreshError } = await supabase
        .from("profiles")
        .select(
          "id,full_name,user_mobile,lottery_id,account_status,user_role,user_birthday,postal_code,city_address,user_address_store,address_verified,identification_verified,user_lottery_fee_paid,user_lottery_is_terms_accepted,balance,created_at"
        )
        .eq("id", authData.user.id)
        .single();

      if (refreshError) {
        console.error("Profile refresh error:", refreshError);
        throw new Error(
          `Update succeeded, but profile refresh failed: ${refreshError.message} (Code: ${refreshError.code || "unknown"})`
        );
      }

      if (!updated) {
        throw new Error("Update succeeded, but refreshed profile was not found.");
      }

      setProfile(updated as Profile);
      fillForm(updated as Profile);
      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (err) {
      console.error("Profile save error:", err);

      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "object" &&
              err !== null &&
              "message" in err
            ? String((err as { message: unknown }).message)
            : "Unknown profile update error.";

      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setError("");
    setMessage("");

    try {
      if (!profile?.user_mobile) {
        throw new Error("Account information is unavailable.");
      }

      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match.");
      }

      const email = `${profile.user_mobile}@user.local`;

      const { error: verifyError } =
        await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });

      if (verifyError) {
        throw new Error("Your current password is incorrect.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Password change failed."
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  async function changePin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPinBusy(true);
    setError("");
    setMessage("");

    try {
      if (!/^\d{4}$/.test(currentPin)) {
        throw new Error("Current PIN must contain 4 digits.");
      }

      if (!/^\d{4}$/.test(newPin)) {
        throw new Error("New PIN must contain 4 digits.");
      }

      if (newPin !== confirmPin) {
        throw new Error("New PINs do not match.");
      }

      if (newPin === currentPin) {
        throw new Error("New PIN must be different.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Please log in again.");

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !anonKey) {
        throw new Error("Supabase configuration is missing.");
      }

      const response = await fetch(
        `${url}/functions/v1/profile-pin-change`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            current_pin: currentPin,
            new_pin: newPin,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "PIN change failed.");
      }

      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setPinOpen(false);
      setMessage("Secret PIN changed successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "PIN change failed."
      );
    } finally {
      setPinBusy(false);
    }
  }

  function support() {
    router.push("/Support-center/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b1713]">
        <style>{`
          @keyframes profilePulse {
            0%,100% { transform:scale(1); opacity:.65; }
            50% { transform:scale(1.12); opacity:1; }
          }
          @keyframes profileRing {
            from { transform:rotate(0deg); }
            to { transform:rotate(360deg); }
          }
          .profile-pulse { animation:profilePulse 1.4s ease-in-out infinite; }
          .profile-ring { animation:profileRing 2s linear infinite; transform-origin:center; }
          .premium-card {
            background: linear-gradient(145deg, #172820 0%, #111d18 100%);
            border: 1px solid #2b4035;
            box-shadow: 0 12px 35px rgba(0,0,0,.16);
          }
          .premium-input:focus {
            border-color: #52b788 !important;
            box-shadow: 0 0 0 3px rgba(82,183,136,.10);
          }
          .premium-action {
            transition: all .2s ease;
          }
          .premium-action:active {
            transform: scale(.985);
          }
        `}</style>

        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full profile-ring">
            <circle cx="50" cy="50" r="43" fill="none" stroke="#315c43" strokeWidth="4" />
            <path d="M50 7 A43 43 0 0 1 93 50" fill="none" stroke="#52b788" strokeWidth="4" strokeLinecap="round" />
          </svg>

          <svg viewBox="0 0 48 48" className="w-12 h-12 profile-pulse" fill="none" stroke="#b8f5ce" strokeWidth="2">
            <circle cx="24" cy="15" r="8" />
            <path d="M8 42c0-9 7-15 16-15s16 6 16 15" strokeLinecap="round" />
            <path d="M35 8l3 3 5-5" stroke="#52b788" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <p className="text-white text-xs font-bold tracking-[3px] mt-5">
          LOADING PROFILE
        </p>
        <p className="text-[#8ca797] text-[11px] mt-2">
          Preparing your account...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1713] text-white pb-24">
      <style>{`
        .premium-card {
          background: linear-gradient(145deg, #172820 0%, #111d18 100%);
          border: 1px solid #2b4035;
          box-shadow: 0 12px 35px rgba(0,0,0,.16);
        }
        .premium-input:focus {
          border-color: #52b788 !important;
          box-shadow: 0 0 0 3px rgba(82,183,136,.10);
        }
        .premium-action {
          transition: all .2s ease;
        }
        .premium-action:active {
          transform: scale(.985);
        }
        .premium-divider {
          border-color: rgba(125,153,136,.16);
        }
      `}</style>

      <LotteryHeader userProfile={profile} />

      <main className="max-w-2xl mx-auto px-3 sm:px-5 py-5 space-y-5">
        {/* PAGE INTRO */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[10px] font-bold tracking-[2.5px] text-[#65b88d] uppercase">
              Account Management
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight mt-1">
              My Profile
            </h1>
            <p className="text-xs text-[#879b8e] mt-1">
              Manage your personal information and account security
            </p>
          </div>

          <div className="w-11 h-11 rounded-2xl bg-[#193729] border border-[#315b43] flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#82d9a8" strokeWidth="1.7">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {pageError && (
          <div className="rounded-2xl border border-red-800/70 bg-red-950/40 p-4 text-sm text-red-200">
            <div className="flex items-start gap-3">
              <span className="text-lg">!</span>
              <div className="flex-1">
                <p className="font-bold">Unable to load profile</p>
                <p className="mt-1 text-xs leading-5">{pageError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-3 text-xs font-bold underline underline-offset-4"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {profile && (
          <>
            {/* PROFILE OVERVIEW */}
            <section className="relative overflow-hidden rounded-3xl border border-[#315a43] bg-gradient-to-br from-[#1b4933] via-[#153725] to-[#10251c] p-5 shadow-[0_18px_45px_rgba(0,0,0,.22)]">
              <div className="absolute -right-12 -top-16 w-48 h-48 rounded-full border border-white/[0.06]" />
              <div className="absolute -right-5 -top-9 w-32 h-32 rounded-full border border-white/[0.05]" />
              <div className="absolute right-10 bottom-[-75px] w-40 h-40 rounded-full bg-[#55bd83]/10 blur-2xl" />

              <div className="relative">
                <div className="flex items-center gap-4">
                  <div className="w-[68px] h-[68px] rounded-2xl bg-gradient-to-br from-[#3d8058] to-[#1c5136] border border-[#8bd5a6]/40 flex items-center justify-center shadow-lg shrink-0">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#eafff0" strokeWidth="1.5">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold tracking-[2px] text-[#a5d9b7] uppercase">
                      Account Profile
                    </p>
                    <h2 className="text-xl font-extrabold truncate mt-1">
                      {profile.full_name || "User"}
                    </h2>
                    <p className="text-xs text-[#c1dfcb] mt-1">
                      Lottery ID: <span className="font-bold tracking-wider">{profile.lottery_id || "—"}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#83d6a2]/30 bg-[#83d6a2]/10 px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#b9f2cc]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#70dc99]" />
                    {(profile.account_status || "unknown").toUpperCase()}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[10px] font-semibold text-[#c4d7ca]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    {profile.user_role || "User"}
                  </span>
                </div>

                {/* BALANCE */}
                <div className="mt-5 rounded-2xl border border-white/[0.10] bg-[#071b12]/45 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold tracking-[2px] text-[#a5d9b7] uppercase">
                        Available Balance
                      </p>
                      <p className="text-[10px] text-[#85a993] mt-1">
                        Your current wallet balance
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#62c58b]/10 border border-[#62c58b]/20 flex items-center justify-center">
                      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#8be0aa" strokeWidth="1.7">
                        <rect x="2.5" y="5" width="19" height="15" rx="3" />
                        <path d="M2.5 9h19M16 14h2" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>

                  <p className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3 tabular-nums">
                    <span className="text-[#a9e9bd] text-2xl mr-1">৳</span>
                    {Number(profile.balance || 0).toLocaleString("en-BD", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#70dc99]" />
                    <p className="text-[10px] text-[#a7c9b2]">
                      Wallet balance · View only
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* FEEDBACK */}
            {message && (
              <div className="rounded-2xl border border-emerald-700/60 bg-emerald-950/40 p-4 text-sm text-emerald-200 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">✓</span>
                {message}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-700/60 bg-red-950/40 p-4 text-sm text-red-200 flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">!</span>
                <span className="break-words">{error}</span>
              </div>
            )}

            {/* PERSONAL INFORMATION */}
            <section className="premium-card rounded-3xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-5 border-b premium-divider">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#214633] border border-[#37664a] flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8bd6a6" strokeWidth="1.7">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-bold text-[15px]">Personal Information</h2>
                    <p className="text-[10px] text-[#82998b] mt-1">Your personal account details</p>
                  </div>
                </div>

                {!editing && (
                  <button
                    onClick={() => {
                      setError("");
                      setMessage("");
                      setEditing(true);
                    }}
                    className="premium-action rounded-xl border border-[#4b9667]/50 bg-[#244b35] px-3 py-2.5 text-[10px] font-extrabold tracking-wide text-[#b8edc8]"
                  >
                    EDIT PROFILE
                  </button>
                )}
              </div>

              <div className="p-5">
                {editing ? (
                  <form onSubmit={saveProfile} className="space-y-4">
                    <div>
                      <label style={labelStyle}>Full Name</label>
                      <input className="premium-input" style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                    </div>

                    <div>
                      <label style={labelStyle}>Birthday</label>
                      <input className="premium-input" style={inputStyle} type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
                    </div>

                    <div>
                      <label style={labelStyle}>Postal Code</label>
                      <input className="premium-input" style={inputStyle} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                    </div>

                    <div>
                      <label style={labelStyle}>City / Area</label>
                      <input className="premium-input" style={inputStyle} value={cityAddress} onChange={(e) => setCityAddress(e.target.value)} />
                    </div>

                    <div>
                      <label style={labelStyle}>Full Address</label>
                      <textarea className="premium-input" style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }} value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button type="submit" disabled={saving} className="premium-action flex-1 rounded-xl bg-gradient-to-r from-[#65c58b] to-[#48a875] text-[#071a10] font-extrabold py-3.5 text-xs tracking-wide shadow-lg shadow-emerald-950/30 disabled:opacity-50">
                        {saving ? "SAVING..." : "SAVE CHANGES"}
                      </button>
                      <button type="button" onClick={() => { fillForm(profile); setEditing(false); }} className="premium-action rounded-xl border border-[#405347] bg-[#25372d] px-6 py-3.5 text-xs font-bold text-[#c6d4ca]">
                        CANCEL
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
                    {[
                      ["Full Name", profile.full_name],
                      ["Mobile Number", profile.user_mobile],
                      ["Birthday", profile.user_birthday],
                      ["Postal Code", profile.postal_code],
                      ["City / Area", profile.city_address],
                      ["Full Address", profile.user_address_store],
                    ].map(([label, value]) => (
                      <div key={label} className="py-3.5 border-b premium-divider last:border-0">
                        <p className="text-[10px] font-semibold tracking-wide text-[#82998b] uppercase">{label}</p>
                        <p className="text-sm font-medium text-[#e3ece6] mt-1.5 break-words">
                          {value || "Not added"}
                        </p>
                      </div>
                    ))}

                    <div className="sm:col-span-2 mt-4 rounded-xl border border-[#344b3c] bg-[#13231a] p-3 flex items-start gap-2.5">
                      <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ac8a9" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
                      </svg>
                      <p className="text-[10px] leading-5 text-[#9caf9f]">
                        Mobile number changes require a separate verification process.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ACCOUNT VERIFICATION */}
            <section className="premium-card rounded-3xl overflow-hidden">
              <div className="p-5 border-b premium-divider flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#214633] border border-[#37664a] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8bd6a6" strokeWidth="1.7">
                    <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-[15px]">Account Verification</h2>
                  <p className="text-[10px] text-[#82998b] mt-1">Review your account requirements</p>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {[
                  ["Lottery Fee", profile.user_lottery_fee_paid ? "Paid" : "Not Paid", profile.user_lottery_fee_paid],
                  ["Terms Accepted", profile.user_lottery_is_terms_accepted ? "Yes" : "No", profile.user_lottery_is_terms_accepted],
                ].map(([label, value, verified]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3 rounded-xl border border-[#304538] bg-[#14231a] px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#203c2c] flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9bcaaa" strokeWidth="1.8">
                          <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-[#c8d7cd]">{label}</span>
                    </div>

                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold ${
                      verified
                        ? "bg-emerald-500/10 text-[#8fe0aa] border border-emerald-500/20"
                        : "bg-amber-500/10 text-[#e6c17b] border border-amber-500/20"
                    }`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* SECURITY SETTINGS */}
            <section className="premium-card rounded-3xl overflow-hidden">
              <div className="p-5 border-b premium-divider flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#214633] border border-[#37664a] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8bd6a6" strokeWidth="1.7">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 018 0v3M12 14v3" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-[15px]">Security Settings</h2>
                  <p className="text-[10px] text-[#82998b] mt-1">Protect your account credentials</p>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {/* PASSWORD */}
                <button
                  onClick={() => {
                    setPasswordOpen(!passwordOpen);
                    setPinOpen(false);
                    setError("");
                    setMessage("");
                  }}
                  className="premium-action w-full flex justify-between items-center gap-3 rounded-2xl border border-[#344d3d] bg-[#17291e] p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#244a34] flex items-center justify-center">
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#a5e4b9" strokeWidth="1.7">
                        <rect x="4" y="10" width="16" height="11" rx="2" />
                        <path d="M8 10V7a4 4 0 018 0v3" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#e5eee8]">Change Password</p>
                      <p className="text-[10px] text-[#849b8c] mt-1">Update your login password</p>
                    </div>
                  </div>
                  <span className="w-7 h-7 rounded-lg bg-[#294536] flex items-center justify-center text-[#a9d9b8] text-lg">
                    {passwordOpen ? "−" : "+"}
                  </span>
                </button>

                {passwordOpen && (
                  <form onSubmit={changePassword} className="rounded-2xl border border-[#344d3d] bg-[#101d16] p-4 space-y-4">
                    <div>
                      <label style={labelStyle}>Current Password</label>
                      <input className="premium-input" style={inputStyle} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>New Password (8+ characters)</label>
                      <input className="premium-input" style={inputStyle} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                    </div>
                    <div>
                      <label style={labelStyle}>Confirm New Password</label>
                      <input className="premium-input" style={inputStyle} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    </div>
                    <button disabled={passwordBusy} className="premium-action w-full rounded-xl bg-gradient-to-r from-[#65c58b] to-[#48a875] text-[#071a10] py-3.5 text-xs font-extrabold tracking-wide disabled:opacity-50">
                      {passwordBusy ? "UPDATING..." : "UPDATE PASSWORD"}
                    </button>
                    <div className="text-right">
                      <button type="button" onClick={support} className="text-xs font-semibold text-[#8ed5a7] underline underline-offset-4">
                        Forgot password? Support
                      </button>
                    </div>
                  </form>
                )}

                {/* SECRET PIN */}
                <button
                  onClick={() => {
                    setPinOpen(!pinOpen);
                    setPasswordOpen(false);
                    setError("");
                    setMessage("");
                  }}
                  className="premium-action w-full flex justify-between items-center gap-3 rounded-2xl border border-[#344d3d] bg-[#17291e] p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#244a34] flex items-center justify-center">
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#a5e4b9" strokeWidth="1.7">
                        <circle cx="8" cy="15" r="4" />
                        <path d="M11 12l8-8M16 7l2 2M18 5l2 2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#e5eee8]">Change Secret PIN</p>
                      <p className="text-[10px] text-[#849b8c] mt-1">Manage your 4-digit security PIN</p>
                    </div>
                  </div>
                  <span className="w-7 h-7 rounded-lg bg-[#294536] flex items-center justify-center text-[#a9d9b8] text-lg">
                    {pinOpen ? "−" : "+"}
                  </span>
                </button>

                {pinOpen && (
                  <form onSubmit={changePin} className="rounded-2xl border border-[#344d3d] bg-[#101d16] p-4 space-y-4">
                    <div>
                      <label style={labelStyle}>Current 4-Digit PIN</label>
                      <input className="premium-input" style={inputStyle} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))} required />
                    </div>
                    <div>
                      <label style={labelStyle}>New 4-Digit PIN</label>
                      <input className="premium-input" style={inputStyle} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Confirm New PIN</label>
                      <input className="premium-input" style={inputStyle} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))} required />
                    </div>
                    <button disabled={pinBusy} className="premium-action w-full rounded-xl bg-gradient-to-r from-[#65c58b] to-[#48a875] text-[#071a10] py-3.5 text-xs font-extrabold tracking-wide disabled:opacity-50">
                      {pinBusy ? "UPDATING..." : "UPDATE SECRET PIN"}
                    </button>
                    <div className="text-right">
                      <button type="button" onClick={support} className="text-xs font-semibold text-[#8ed5a7] underline underline-offset-4">
                        Forgot PIN? Support
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>

            {/* ACCOUNT INFORMATION */}
            <section className="premium-card rounded-3xl overflow-hidden">
              <div className="p-5 border-b premium-divider flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#214633] border border-[#37664a] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8bd6a6" strokeWidth="1.7">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-[15px]">Account Information</h2>
                  <p className="text-[10px] text-[#82998b] mt-1">Your account registration details</p>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#304538] bg-[#14231a] px-4 py-4">
                  <div>
                    <p className="text-[10px] font-semibold tracking-wide text-[#82998b] uppercase">
                      Join Date
                    </p>
                    <p className="text-sm font-bold text-[#e3ece6] mt-1.5">
                      {profile.created_at
                        ? new Date(profile.created_at).toLocaleDateString("en-GB")
                        : "—"}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-[#203c2c] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9bcaaa" strokeWidth="1.7">
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </section>

            <div className="text-center pt-1 pb-2">
              <p className="text-[10px] text-[#657c6d] tracking-wide">
                Your account information is protected
              </p>
            </div>
          </>
        )}
      </main>

      <LotteryFooter />
    </div>
  );
}
