"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, Mail, Phone, ArrowRight,
  ShieldCheck, AlertCircle, RotateCcw
} from "lucide-react";
import styles from "./page.module.css";
import { login, otpVerify, otpResend } from "@/services/api";

export default function LoginPage() {
  const [step, setStep] = useState("login");
  const [verifyMethod, setVerifyMethod] = useState("email");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const countdownRef = useRef(null);
  const inputs = useRef([]);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setApiError("");
  }

  function validate() {
    const e = {};
    if (!form.email.trim()) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Required";
    return e;
  }

  function startCountdown() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(60);
    setCanResend(false);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e) {
  e.preventDefault();
  const errs = validate();
  if (Object.keys(errs).length > 0) { setErrors(errs); return; }

  setLoading(true);
  setApiError("");

  try {
    await login({ email: form.email, password: form.password });
    // Backend always requires OTP — no tokens returned here
    setStep("otp");
    startCountdown();
  } catch (err) {
    setApiError(
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      "Invalid email or password. Please try again."
    );
  } finally {
    setLoading(false);
  }
}

  function handleOtpChange(index, value) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError("");
    if (value && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === "Backspace" && !otp[index] && index > 0) inputs.current[index - 1]?.focus();
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    pasted.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleResend() {
  if (!canResend) return;
  setOtp(["", "", "", "", "", ""]);
  setOtpError("");
  startCountdown();
  inputs.current[0]?.focus();
  
  try {
    await otpResend({ email: form.email });
  } catch (err) {
    setOtpError(err?.response?.data?.message || "Failed to resend code. Please try again.");
  }
}

  function switchMethod(method) {
    setVerifyMethod(method);
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    startCountdown();
    // TODO: API call — POST /auth/otp/resend/ with { email: form.email, method: method }
    // This tells the backend to send OTP to the newly selected method
  }

  async function handleOtpSubmit(e) {
  e.preventDefault();
  const code = otp.join("");
  if (code.length < 6) { setOtpError("Please enter the complete 6-digit code."); return; }

  setLoading(true);
  setOtpError("");

  try {
    await otpVerify({ email: form.email, code });
    // Cookies are set by the backend — nothing to store, just redirect
    window.location.href = "/dashboard";
  } catch (err) {
    setOtpError(
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      "Invalid or expired code. Please try again."
    );
  } finally {
    setLoading(false);
  }
}
  // OTP STEP
  if (step === "otp") {
    return (
      <div className={styles.page}>
        <div className={styles.main}>
          <div className={styles.card}>

            <div className={styles.logoWrap}>
              <Link href="/" className={styles.logo}>
                <div className={styles.logoBox}><span className={styles.logoLetter}>R</span></div>
                <div className={styles.logoText}>
                  <span className={styles.logoName}>RMHCDT</span>
                  <span className={styles.logoSub}>Youth Portal</span>
                </div>
              </Link>
            </div>

            <div className={styles.cardHeader}>
              <h1 className={styles.cardTitle}>Verify Login</h1>
              <p className={styles.cardSubtitle}>
                Choose how you want to receive your verification code.
              </p>
            </div>

            <form className={styles.form} onSubmit={handleOtpSubmit}>

              <div className={styles.sectionLabel}>Verification Method</div>
              <div className={styles.verifyToggle}>
                <button
                  type="button"
                  onClick={() => switchMethod("email")}
                  className={styles.verifyToggleBtn + (verifyMethod === "email" ? " " + styles.verifyToggleActive : "")}
                >
                  <Mail size={15} /> Email
                </button>
                <button
                  type="button"
                  disabled
                  className={styles.verifyToggleBtn}
                  style={{ opacity: 0.4, cursor: "not-allowed" }}
                >
                  <Phone size={15} /> Phone
                  <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500 }}>(Soon)</span>
                </button>
              </div>

              <span className={styles.hint} style={{ textAlign: "center" }}>
                {verifyMethod === "email"
                  ? <>Code sent to <strong style={{ color: "#0f172a" }}>{form.email}</strong></>
                  : <>Code sent to your registered phone number</>
                }
              </span>

              <div className={styles.sectionLabel}>Enter Code</div>
              <div className={styles.otpWrap}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handlePaste}
                    className={styles.otpInput + (otpError ? " " + styles.inputError : "")}
                  />
                ))}
              </div>

              {otpError && (
                <span className={styles.error} style={{ textAlign: "center" }}>{otpError}</span>
              )}

              <span className={styles.hint} style={{ textAlign: "center" }}>
                {canResend ? (
                  <button type="button" onClick={handleResend} className={styles.resendBtn}>
                    <RotateCcw size={13} /> Resend Code
                  </button>
                ) : (
                  <>Resend code in <strong style={{ color: "#0f172a" }}>{countdown}s</strong></>
                )}
              </span>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <><span className={styles.spinner} /> Verifying...</>
                ) : (
                  <>Verify & Sign In <ArrowRight size={15} strokeWidth={2} /></>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep("login"); setOtp(["","","","","",""]); setOtpError(""); }}
                className={styles.registerBtn}
                style={{ width: "100%" }}
              >
                Back to Login
              </button>

            </form>

            <div className={styles.bottomBadge}>
              <ShieldCheck size={13} color="#15803d" strokeWidth={2} />
              <span>Secured under the Petroleum Industry Act, 2021</span>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // LOGIN STEP
  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.card}>

          <div className={styles.logoWrap}>
            <Link href="/" className={styles.logo}>
              <div className={styles.logoBox}>
                <span className={styles.logoLetter}>R</span>
              </div>
              <div className={styles.logoText}>
                <span className={styles.logoName}>RMHCDT</span>
                <span className={styles.logoSub}>Youth Portal</span>
              </div>
            </Link>
          </div>

          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Sign In</h1>
            <p className={styles.cardSubtitle}>
              Welcome back. Enter your credentials to continue.
            </p>
          </div>

          {apiError && (
            <div className={styles.apiBanner}>
              <AlertCircle size={16} color="#dc2626" strokeWidth={2} />
              {apiError}
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.sectionLabel}>Account Details</div>

            <div className={styles.field}>
              <label className={styles.label}>Email Address</label>
              <div className={styles.inputWrap}>
                <Mail size={15} color="#94a3b8" className={styles.inputIcon} />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className={styles.input + (errors.email ? " " + styles.inputError : "")}
                />
              </div>
              {errors.email && <span className={styles.error}>{errors.email}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={styles.input + " " + styles.inputPadRight + (errors.password ? " " + styles.inputError : "")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.eyeBtn}
                >
                  {showPassword
                    ? <EyeOff size={15} color="#94a3b8" />
                    : <Eye size={15} color="#94a3b8" />
                  }
                </button>
              </div>
              {errors.password && <span className={styles.error}>{errors.password}</span>}
            </div>

            <div style={{ textAlign: "right", marginTop: "-4px" }}>
              <Link href="/forgot-password" className={styles.forgotLink}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <><span className={styles.spinner} /> Signing In...</>
              ) : (
                <>Sign In <ArrowRight size={15} strokeWidth={2} /></>
              )}
            </button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>Don't have an account?</span>
            <span className={styles.dividerLine} />
          </div>

          <Link href="/register" className={styles.registerBtn}>
            Create an Account
          </Link>

          <div className={styles.bottomBadge}>
            <ShieldCheck size={13} color="#15803d" strokeWidth={2} />
            <span>Secured under the Petroleum Industry Act, 2021</span>
          </div>

        </div>
      </div>
    </div>
  );
}