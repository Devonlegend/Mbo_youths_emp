"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, Mail, ArrowRight,
  ShieldCheck, AlertCircle, RotateCcw, LogIn,
} from "lucide-react";
import styles from "./page.module.css";
import { login, otpVerify, otpResend, getMe } from "@/services/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState("login");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const countdownRef = useRef(null);
  const inputs = useRef([]);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [apiError, setApiError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  // ── IF ALREADY LOGGED IN → GO TO DASHBOARD ────────────────────────────────
  useEffect(() => {
    getMe()
      .then(() => {
        // Valid cookie exists — user is already logged in
        router.replace("/dashboard");
      })
      .catch(() => {
        // Not logged in — show the login form
        setCheckingAuth(false);
      });
  }, []);

  // Don't render the form until we've confirmed they're not already logged in
  // This prevents a flash of the login form before the redirect fires
  if (checkingAuth) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "#f8fafc",
    }}>
      <div style={{
        width: 28, height: 28,
        borderRadius: "50%",
        border: "2.5px solid #e2e8f0",
        borderTopColor: "#15803d",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

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
      await otpResend({ email: form.email });
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

  async function handleOtpSubmit(e) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Please enter the complete 6-digit code."); return; }

    setLoading(true);
    setOtpError("");

    try {
      await otpVerify({ email: form.email, code });
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

  const Logo = () => (
    <div className={styles.logoWrap}>
      <Link href="/" className={styles.logo}>
        <div className={styles.logoBox}><span className={styles.logoLetter}>R</span></div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>RMHCDT</span>
          <span className={styles.logoSub}>Youth Portal</span>
        </div>
      </Link>
    </div>
  );

  // ── OTP STEP ───────────────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <div className={styles.page}>
        <div className={styles.main}>
          <div className={styles.card}>
            <Logo />

            <div className={styles.otpScreen}>
              <div className={styles.otpIconRing}>
                <Mail size={26} color="#15803d" strokeWidth={1.8} />
              </div>
              <h1 className={styles.otpTitle}>Check your email</h1>
              <p className={styles.otpSubtitle}>
                We sent a 6-digit verification code to
              </p>
              <div className={styles.otpEmailBadge}>
                <Mail size={13} color="#15803d" />
                {form.email}
              </div>
            </div>

            <form className={styles.form} onSubmit={handleOtpSubmit}>
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

              <div className={styles.otpResendRow}>
                {canResend ? (
                  <>
                    Didn't receive it?&nbsp;
                    <button type="button" onClick={handleResend} className={styles.resendBtn}>
                      <RotateCcw size={12} /> Resend code
                    </button>
                  </>
                ) : (
                  <>Resend code in <strong style={{ color: "#0f172a", marginLeft: 4 }}>{countdown}s</strong></>
                )}
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading
                  ? <><span className={styles.spinner} /> Verifying…</>
                  : <><ShieldCheck size={15} strokeWidth={2} /> Verify & Sign In</>
                }
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

  // ── LOGIN STEP ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.card}>
          <Logo />

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
            <div className={styles.sectionLabel}>
              <LogIn size={13} color="#15803d" strokeWidth={2.5} style={{ flexShrink: 0 }} />
              Account Details
            </div>

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
                  className={
                    styles.input + " " + styles.inputPadRight +
                    (errors.password ? " " + styles.inputError : "")
                  }
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
              {loading
                ? <><span className={styles.spinner} /> Signing In…</>
                : <>Sign In <ArrowRight size={15} strokeWidth={2} /></>
              }
            </button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>Don't have an account?</span>
            <span className={styles.dividerLine} />
          </div>

          <Link href="/register" className={styles.signinBtn}>
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