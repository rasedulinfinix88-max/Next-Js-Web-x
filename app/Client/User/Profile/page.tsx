
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
  padding: "12px",
  borderRadius: "9px",
  background: "#111b16",
  border: "1px solid #34483b",
  color: "#ffffff",
  outline: "none",
  fontSize: "14px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#a9b9ae",
  fontSize: "12px",
  marginBottom: "7px",
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

      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Please log in again.");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          user_birthday: birthday || null,
          postal_code: postalCode.trim() || null,
          city_address: cityAddress.trim() || null,
          user_address_store: fullAddress.trim() || null,
          update_at: new Date().toISOString(),
        })
        .eq("id", authData.user.id);

      if (updateError) throw updateError;

      const { data: updated, error: refreshError } = await supabase
        .from("profiles")
        .select(
          "id,full_name,user_mobile,lottery_id,account_status,user_role,user_birthday,postal_code,city_address,user_address_store,address_verified,identification_verified,user_lottery_fee_paid,user_lottery_is_terms_accepted,balance,created_at"
        )
        .eq("id", authData.user.id)
        .single();

      if (refreshError) throw refreshError;

      setProfile(updated as Profile);
      fillForm(updated as Profile);
      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Profile update failed."
      );
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

  function status(value: boolean | null | undefined) {
    return value ? "Verified" : "Not Verified";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d241e]">
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
        `}</style>

        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full profile-ring">
            <circle cx="50" cy="50" r="43" fill="none" stroke="#315c43" strokeWidth="4" />
            <path d="M50 7 A43 43 0 0 1 93 50" fill="none" stroke="#00e676" strokeWidth="4" strokeLinecap="round" />
          </svg>

          <svg viewBox="0 0 48 48" className="w-12 h-12 profile-pulse" fill="none" stroke="#b8f5ce" strokeWidth="2">
            <circle cx="24" cy="15" r="8" />
            <path d="M8 42c0-9 7-15 16-15s16 6 16 15" strokeLinecap="round" />
            <path d="M35 8l3 3 5-5" stroke="#00e676" strokeLinecap="round" strokeLinejoin="round" />
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
    <div className="min-h-screen bg-[#0d241e] text-white pb-24">
      <LotteryHeader userProfile={profile} />

      <main className="max-w-xl mx-auto px-3 py-4 space-y-4">
        {pageError && (
          <div className="bg-red-950/40 border border-red-700 rounded-xl p-4 text-sm text-red-200">
            {pageError}
            <button
              onClick={() => window.location.reload()}
              className="block mt-3 underline"
            >
              Try Again
            </button>
          </div>
        )}

        {profile && (
          <>
            <section className="rounded-2xl border border-[#315640] bg-gradient-to-br from-[#194b34] to-[#10291e] p-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-[#286647] border border-[#70c993] flex items-center justify-center">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <h1 className="font-bold text-lg truncate">
                    {profile.full_name || "User"}
                  </h1>
                  <p className="text-xs text-green-200 mt-1">
                    Lottery ID: {profile.lottery_id || "—"}
                  </p>
                  <span className="inline-block mt-2 text-[10px] bg-green-500/20 text-green-200 px-2 py-1 rounded-full">
                    {(profile.account_status || "unknown").toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-black/20 p-3">
                <p className="text-xs text-green-200">AVAILABLE BALANCE</p>
                <p className="text-2xl font-extrabold mt-1">
                  ৳ {Number(profile.balance || 0).toLocaleString("en-BD", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-[10px] text-green-200/70 mt-1">
                  Wallet balance · View only
                </p>
              </div>
            </section>

            {message && (
              <div className="rounded-lg border border-green-600 bg-green-950/40 p-3 text-sm text-green-200">
                {message}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <section className="rounded-xl border border-[#2b4034] bg-[#17251d] p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Personal Information</h2>
                {!editing && (
                  <button
                    onClick={() => {
                      setError("");
                      setMessage("");
                      setEditing(true);
                    }}
                    className="text-xs font-bold text-green-300 border border-green-700 rounded-lg px-3 py-2"
                  >
                    EDIT PROFILE
                  </button>
                )}
              </div>

              {editing ? (
                <form onSubmit={saveProfile} className="space-y-3">
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>

                  <div>
                    <label style={labelStyle}>Birthday</label>
                    <input style={inputStyle} type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
                  </div>

                  <div>
                    <label style={labelStyle}>Postal Code</label>
                    <input style={inputStyle} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                  </div>

                  <div>
                    <label style={labelStyle}>City / Area</label>
                    <input style={inputStyle} value={cityAddress} onChange={(e) => setCityAddress(e.target.value)} />
                  </div>

                  <div>
                    <label style={labelStyle}>Full Address</label>
                    <textarea style={{ ...inputStyle, minHeight: "85px" }} value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[#00e676] text-black font-bold py-3 disabled:opacity-50">
                      {saving ? "SAVING..." : "SAVE CHANGES"}
                    </button>
                    <button type="button" onClick={() => { fillForm(profile); setEditing(false); }} className="px-4 rounded-lg bg-[#34443a] font-semibold">
                      CANCEL
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {[
                    ["Full Name", profile.full_name],
                    ["Mobile Number", profile.user_mobile],
                    ["Birthday", profile.user_birthday],
                    ["Postal Code", profile.postal_code],
                    ["City / Area", profile.city_address],
                    ["Full Address", profile.user_address_store],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-[#2c4034] pb-3 last:border-0">
                      <p className="text-[11px] text-[#91a99a]">{label}</p>
                      <p className="text-sm mt-1 break-words">{value || "Not added"}</p>
                    </div>
                  ))}
                  <p className="text-[10px] text-[#82988a]">
                    Mobile number changes require a separate verification process.
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[#2b4034] bg-[#17251d] p-4">
              <h2 className="font-bold mb-4">Account Verification</h2>
              {[
                ["Address Verification", status(profile.address_verified)],
                ["Identity Verification", status(profile.identification_verified)],
                ["Lottery Fee", profile.user_lottery_fee_paid ? "Paid" : "Not Paid"],
                ["Terms Accepted", profile.user_lottery_is_terms_accepted ? "Yes" : "No"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-2 border-b border-[#2c4034] last:border-0">
                  <span className="text-xs text-[#a9b9ae]">{label}</span>
                  <span className="text-xs font-semibold">{value}</span>
                </div>
              ))}
            </section>

            <section className="rounded-xl border border-[#2b4034] bg-[#17251d] p-4 space-y-3">
              <h2 className="font-bold">Security Settings</h2>

              <button
                onClick={() => {
                  setPasswordOpen(!passwordOpen);
                  setPinOpen(false);
                  setError("");
                  setMessage("");
                }}
                className="w-full flex justify-between items-center bg-[#20372a] rounded-lg p-3 text-sm font-semibold"
              >
                <span>Change Password</span>
                <span>{passwordOpen ? "−" : "+"}</span>
              </button>

              {passwordOpen && (
                <form onSubmit={changePassword} className="space-y-3">
                  <div>
                    <label style={labelStyle}>Current Password</label>
                    <input style={inputStyle} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                  </div>
                  <div>
                    <label style={labelStyle}>New Password (8+ characters)</label>
                    <input style={inputStyle} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm New Password</label>
                    <input style={inputStyle} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                  </div>
                  <button disabled={passwordBusy} className="w-full bg-[#00e676] text-black rounded-lg py-3 font-bold">
                    {passwordBusy ? "UPDATING..." : "UPDATE PASSWORD"}
                  </button>
                  <div className="text-right">
                    <button type="button" onClick={support} className="text-xs text-green-300 underline">
                      Forgot password? Support
                    </button>
                  </div>
                </form>
              )}

              <button
                onClick={() => {
                  setPinOpen(!pinOpen);
                  setPasswordOpen(false);
                  setError("");
                  setMessage("");
                }}
                className="w-full flex justify-between items-center bg-[#20372a] rounded-lg p-3 text-sm font-semibold"
              >
                <span>Change Secret PIN</span>
                <span>{pinOpen ? "−" : "+"}</span>
              </button>

              {pinOpen && (
                <form onSubmit={changePin} className="space-y-3">
                  <div>
                    <label style={labelStyle}>Current 4-Digit PIN</label>
                    <input style={inputStyle} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))} required />
                  </div>
                  <div>
                    <label style={labelStyle}>New 4-Digit PIN</label>
                    <input style={inputStyle} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm New PIN</label>
                    <input style={inputStyle} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))} required />
                  </div>
                  <button disabled={pinBusy} className="w-full bg-[#00e676] text-black rounded-lg py-3 font-bold">
                    {pinBusy ? "UPDATING..." : "UPDATE SECRET PIN"}
                  </button>
                  <div className="text-right">
                    <button type="button" onClick={support} className="text-xs text-green-300 underline">
                      Forgot PIN? Support
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section className="rounded-xl border border-[#2b4034] bg-[#17251d] p-4">
              <h2 className="font-bold mb-3">Account Information</h2>
              <div className="flex justify-between py-2">
                <span className="text-xs text-[#a9b9ae]">Account Role</span>
                <span className="text-xs">{profile.user_role || "user"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-xs text-[#a9b9ae]">Created Date</span>
                <span className="text-xs">
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString("en-GB")
                    : "—"}
                </span>
              </div>
            </section>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/user/login/");
              }}
              className="w-full rounded-xl border border-red-800 bg-red-950/40 text-red-300 font-bold py-3"
            >
              LOG OUT
            </button>
          </>
        )}
      </main>

      <LotteryFooter />
    </div>
  );
}

