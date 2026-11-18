
"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");
  const redirectPath = searchParams.get("redirect");

  const [isLoadingPage, setIsLoadingPage] = useState(true);

  const [formData, setFormData] = useState({
    full_name: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    secret_pin: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSecretPin, setShowSecretPin] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoadingPage(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "secret_pin") {
      if (!/^\d{0,4}$/.test(value)) return;
    }

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.full_name.trim()) {
      setError("আপনার Full Name লিখুন।");
      setLoading(false);
      return;
    }

    if (!/^01\d{9}$/.test(formData.mobile)) {
      setError("Please enter a valid 11 digit mobile number (01XXXXXXXXX).");
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (!/^\d{4}$/.test(formData.secret_pin)) {
      setError("Secret PIN অবশ্যই ৪ ডিজিটের হতে হবে।");
      setLoading(false);
      return;
    }

    try {
      const { data, error: funcError } =
        await supabase.functions.invoke("auth-manager", {
          body: {
            action: "signup",
            full_name: formData.full_name.trim(),
            mobile: formData.mobile,
            password: formData.password,
            secret_pin: formData.secret_pin,
            ref: refCode,
          },
        });

      if (funcError || data?.error) {
        throw new Error(
          data?.error || funcError?.message || "Signup failed.",
        );
      }

      if (!data?.lottery_id) {
        throw new Error("Lottery ID পাওয়া যায়নি। আবার চেষ্টা করুন।");
      }

      const params = new URLSearchParams();
      params.set("lottery_id", data.lottery_id);

      if (redirectPath) {
        params.set("redirect", redirectPath);
      }

      router.push(`/Client/Login?${params.toString()}`);
    } catch (err: any) {
      setError(err.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingPage) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#18221E" }}
      >
        <div
          className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: "#263C32", borderTopColor: "#00E701" }}
        ></div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ backgroundColor: "#18221E" }}
    >
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.04]">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.5"
        >
          <rect x="10" y="20" width="30" height="30" rx="4" transform="rotate(15 25 35)" />
          <circle cx="18" cy="28" r="1.5" fill="#FFFFFF" />
          <circle cx="32" cy="42" r="1.5" fill="#FFFFFF" />
          <circle cx="25" cy="35" r="1.5" fill="#FFFFFF" />
          <path d="M 70 30 L 75 45 L 90 45 L 78 55 L 82 70 L 70 60 L 58 70 L 62 55 L 50 45 L 65 45 Z" />
          <path d="M 30 70 C 30 70, 20 85, 20 90 C 20 95, 30 95, 30 90 C 30 95, 40 95, 40 90 C 40 85, 30 70, 30 70 Z" />
        </svg>
      </div>

      <div
        className="w-full max-w-sm rounded-xl shadow-lg relative z-10 backdrop-blur-sm"
        style={{
          backgroundColor: "rgba(27, 42, 35, 0.95)",
          border: "1px solid #263C32",
          padding: "24px 20px",
        }}
      >
        <h1 className="text-xl font-bold text-white text-center mb-5">
          Register
        </h1>

        {error && (
          <div
            className="text-sm p-2 rounded mb-4 text-center"
            style={{
              background: "rgba(255, 77, 77, 0.1)",
              color: "#ff4d4d",
              border: "1px solid rgba(255, 77, 77, 0.3)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="flex flex-col gap-3">

          {/* Full Name */}
          <div>
            <div
              className="flex items-center px-3 rounded-lg"
              style={{
                backgroundColor: "#121816",
                border: "1px solid #263C32",
                height: "44px",
              }}
            >
              <svg className="w-4 h-4 mr-2" style={{ color: "#A0ADB0" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Full Name"
                required
                className="w-full bg-transparent border-none outline-none text-white text-sm"
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div>
            <div
              className="flex items-center px-3 rounded-lg"
              style={{
                backgroundColor: "#121816",
                border: "1px solid #263C32",
                height: "44px",
              }}
            >
              <svg className="w-4 h-4 mr-2" style={{ color: "#A0ADB0" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="Mobile Number (01XXXXXXXXX)"
                maxLength={11}
                required
                className="w-full bg-transparent border-none outline-none text-white text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div
              className="flex items-center px-3 rounded-lg"
              style={{
                backgroundColor: "#121816",
                border: "1px solid #263C32",
                height: "44px",
              }}
            >
              <svg className="w-4 h-4 mr-2" style={{ color: "#A0ADB0" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
                required
                className="w-full bg-transparent border-none outline-none text-white text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="ml-2"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#A0ADB0" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <div
              className="flex items-center px-3 rounded-lg"
              style={{
                backgroundColor: "#121816",
                border: "1px solid #263C32",
                height: "44px",
              }}
            >
              <svg className="w-4 h-4 mr-2" style={{ color: "#A0ADB0" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Password"
                required
                className="w-full bg-transparent border-none outline-none text-white text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="ml-2"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#A0ADB0" }}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Secret PIN */}
          <div>
            <label
              className="text-sm font-semibold mb-1.5 block"
              style={{ color: "#A0ADB0" }}
            >
              Secret PIN (4 Digits)
            </label>
            <div
              className="flex items-center px-3 rounded-lg"
              style={{
                backgroundColor: "#121816",
                border: "1px solid #263C32",
                height: "44px",
              }}
            >
              <svg className="w-4 h-4 mr-2" style={{ color: "#A0ADB0" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                type={showSecretPin ? "text" : "password"}
                name="secret_pin"
                value={formData.secret_pin}
                onChange={handleChange}
                placeholder="Enter 4 Digit Secret PIN"
                inputMode="numeric"
                maxLength={4}
                required
                className="w-full bg-transparent border-none outline-none text-white text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSecretPin(!showSecretPin)}
                className="ml-2"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#A0ADB0" }}
              >
                {showSecretPin ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold text-sm py-2.5 rounded-lg mt-2 transition-colors disabled:opacity-50 flex justify-center items-center"
            style={{
              backgroundColor: "#00E701",
              color: "#000",
              height: "44px",
            }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                REGISTER
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-center mt-4" style={{ color: "#A0ADB0" }}>
          Already have an account?{" "}
          <Link
            href={`/Client/Login${redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
            className="font-semibold hover:underline"
            style={{ color: "#00E701" }}
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#18221E" }}></div>}>
      <SignupForm />
    </Suspense>
  );
}
