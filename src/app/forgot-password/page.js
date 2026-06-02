"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Mail, ArrowRight, ShieldCheck, AlertCircle,
  RotateCcw, Eye, EyeOff, CheckCircle2, Lock, KeyRound
} from "lucide-react";
import styles from "./page.module.css";
import {
  forgotPasswordRequest,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
} from "@/services/auth";

function getStrength(pw) {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#15803d"];
  return { score, checks, label: labels[score] || "", color: colors[score] || "" };
}

function Shell({ children }) {
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
            {children}
            <div className={styles.bottomBadge}>
              <ShieldCheck size={13} color="#15803d" strokeWidth={2} />
              <span>Secured under the Petroleum Industry Act, 2021</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

export default function ForgotPasswordPage() {
  const [step, setStep] = useState("email");

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const countdownRef = useRef(null);
  const otpInputs = useRef([]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetErrors, setResetErrors] = useState({});

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (step === "otp") {
      const timer = setTimeout(() => {
        otpInputs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

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

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setEmailError("Required"); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setEmailError("Enter a valid email address"); return; }

    setLoading(true);
    setApiError("");
    try {
      await forgotPasswordRequest({ email });
      setStep("otp");
      startCountdown();
    } catch (err) {
      setApiError(
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index, value) {
  const digit = value.replace(/\D/g, "");
  if (!digit && value !== "") return;

  const newOtp = [...otp];

  if (digit.length > 1) {
    digit.split("").slice(0, 6 - index).forEach((char, i) => {
      newOtp[index + i] = char;
    });
    setOtp(newOtp);
    setOtpError("");
    const nextIndex = Math.min(index + digit.length, 5);
    setTimeout(() => otpInputs.current[nextIndex]?.focus(), 0);
    return;
  }

  newOtp[index] = digit;
  setOtp(newOtp);
  setOtpError("");
  if (digit && index < 5) {
    setTimeout(() => otpInputs.current[index + 1]?.focus(), 0);
  }
}

function handleOtpKeyDown(index, e) {
  if (e.key === "Backspace") {
    const newOtp = [...otp];
    if (otp[index]) {
      newOtp[index] = "";
      setOtp(newOtp);
    } else if (index > 0) {
      newOtp[index - 1] = "";
      setOtp(newOtp);
      setTimeout(() => otpInputs.current[index - 1]?.focus(), 0);
    }
  }
  if (e.key === "ArrowLeft" && index > 0) otpInputs.current[index - 1]?.focus();
  if (e.key === "ArrowRight" && index < 5) otpInputs.current[index + 1]?.focus();
}

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newOtp = ["", "", "", "", "", ""];
    pasted.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    setOtpError("");
    otpInputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleResend() {
    if (!canResend) return;
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    startCountdown();
    setTimeout(() => otpInputs.current[0]?.focus(), 100);
    try {
      await forgotPasswordRequest({ email });
    } catch (err) {
      setOtpError(err?.response?.data?.message || "Failed to resend. Please try again.");
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Please enter the complete 6-digit code."); return; }

    setLoading(true);
    setOtpError("");
    try {
      await forgotPasswordVerifyOtp({ email, code });
      setStep("reset");
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

  const strength = getStrength(password);

  function validateReset() {
    const e = {};
    if (!password) e.password = "Required";
    else if (strength.score < 3) e.password = "Password is too weak";
    if (!confirm) e.confirm = "Required";
    else if (password !== confirm) e.confirm = "Passwords do not match";
    return e;
  }

  async function handleResetSubmit(ev) {
    ev.preventDefault();
    const errs = validateReset();
    if (Object.keys(errs).length > 0) { setResetErrors(errs); return; }

    setLoading(true);
    setApiError("");
    try {
      await forgotPasswordReset({ email, code: otp.join(""), new_password: password });
      setStep("done");
    } catch (err) {
      setApiError(
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Failed to reset password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }


  // ── STEP 1: Enter email ────────────────────────────────────────────────
  if (step === "email") return (
    <Shell>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>Forgot Password</h1>
        <p className={styles.cardSubtitle}>
          Enter the email address linked to your account and we'll send you a reset code.
        </p>
      </div>

      {apiError && (
        <div className={styles.apiBanner}>
          <AlertCircle size={16} color="#dc2626" strokeWidth={2} />
          {apiError}
        </div>
      )}

      <form className={styles.form} onSubmit={handleEmailSubmit}>
        <div className={styles.sectionLabel}>
          <Mail size={13} color="#15803d" strokeWidth={2.5} style={{ flexShrink: 0 }} />
          Login Email
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Email Address</label>
          <div className={styles.inputWrap}>
            <Mail size={15} color="#94a3b8" className={styles.inputIcon} />
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              placeholder="your@email.com"
              autoComplete="email"
              className={styles.input + (emailError ? " " + styles.inputError : "")}
            />
          </div>
          {emailError && <span className={styles.error}>{emailError}</span>}
          <span className={styles.hint}>
            We'll send a 6-digit code to this address. Check your spam folder if it doesn't arrive within a minute.
          </span>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading
            ? <><span className={styles.spinner} /> Sending Code...</>
            : <>Send Reset Code <ArrowRight size={15} strokeWidth={2} /></>
          }
        </button>
      </form>

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>Remember your password?</span>
        <span className={styles.dividerLine} />
      </div>
      <Link href="/login" className={styles.signinBtn}>Back to Sign In</Link>
    </Shell>
  );

  // ── STEP 2: OTP ────────────────────────────────────────────────────────
  if (step === "otp") return (
    <Shell>
      <div className={styles.otpScreen}>
        <div className={styles.otpIconRing}>
          <Mail size={26} color="#15803d" strokeWidth={1.8} />
        </div>
        <h1 className={styles.otpTitle}>Check your email</h1>
        <p className={styles.otpSubtitle}>
          We sent a 6-digit reset code to
        </p>
        <div className={styles.otpEmailBadge}>
          <Mail size={13} color="#15803d" />
          {email}
        </div>
      </div>

      <form className={styles.form} onSubmit={handleOtpSubmit}>
        <div className={styles.otpWrap}>
          {otp.map((digit, i) => (
            <input
  key={i}
  ref={(el) => (otpInputs.current[i] = el)}
  type="text"
  inputMode="numeric"
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
            ? <><span className={styles.spinner} /> Verifying...</>
            : <>Verify Code <ArrowRight size={15} strokeWidth={2} /></>
          }
        </button>

        <button
          type="button"
          onClick={() => { setStep("email"); setOtp(["","","","","",""]); setOtpError(""); }}
          className={styles.signinBtn}
          style={{ width: "100%" }}
        >
          Use a Different Email
        </button>
      </form>
    </Shell>
  );

  // ── STEP 3: Set new password ───────────────────────────────────────────
  if (step === "reset") return (
    <Shell>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>New Password</h1>
        <p className={styles.cardSubtitle}>
          Choose a strong password for your account.
        </p>
      </div>

      {apiError && (
        <div className={styles.apiBanner}>
          <AlertCircle size={16} color="#dc2626" strokeWidth={2} />
          {apiError}
        </div>
      )}

      <form className={styles.form} onSubmit={handleResetSubmit}>
        <div className={styles.sectionLabel}>
          <KeyRound size={13} color="#15803d" strokeWidth={2.5} style={{ flexShrink: 0 }} />
          Set Password
        </div>

        <div className={styles.field}>
          <label className={styles.label}>New Password</label>
          <div className={styles.inputWrap}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setResetErrors({ ...resetErrors, password: "" }); }}
              placeholder="Create a strong password"
              autoComplete="new-password"
              className={styles.input + " " + styles.inputPadRight + (resetErrors.password ? " " + styles.inputError : "")}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} className={styles.eyeBtn}>
              {showPw ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
            </button>
          </div>
          {resetErrors.password && <span className={styles.error}>{resetErrors.password}</span>}

          {password && (
            <div className={styles.strengthWrap}>
              <div className={styles.strengthRow}>
                <div className={styles.strengthBars} style={{ flex: 1 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className={styles.strengthBar}
                      style={{
                        background: n <= strength.score ? strength.color : "#e2e8f0",
                        flex: 1,
                      }}
                    />
                  ))}
                </div>
                <span className={styles.strengthLabel} style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
              <div className={styles.checkList}>
                {[
                  { key: "length", label: "At least 8 characters" },
                  { key: "upper", label: "Uppercase letter" },
                  { key: "lower", label: "Lowercase letter" },
                  { key: "number", label: "Number" },
                  { key: "special", label: "Special character" },
                ].map(({ key, label }) => (
                  <span
                    key={key}
                    className={styles.checkItem}
                    style={{ color: strength.checks[key] ? "#15803d" : "#94a3b8" }}
                  >
                    <CheckCircle2 size={12} strokeWidth={2.5} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Confirm Password</label>
          <div className={styles.inputWrap}>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setResetErrors({ ...resetErrors, confirm: "" }); }}
              placeholder="Repeat your password"
              autoComplete="new-password"
              className={styles.input + " " + styles.inputPadRight + (resetErrors.confirm ? " " + styles.inputError : "")}
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className={styles.eyeBtn}>
              {showConfirm ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
            </button>
          </div>
          {resetErrors.confirm && <span className={styles.error}>{resetErrors.confirm}</span>}
          {confirm && password === confirm && !resetErrors.confirm && (
            <span className={styles.matchHint}>
              <CheckCircle2 size={13} strokeWidth={2.5} /> Passwords match
            </span>
          )}
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading
            ? <><span className={styles.spinner} /> Resetting...</>
            : <>Reset Password <ArrowRight size={15} strokeWidth={2} /></>
          }
        </button>
      </form>
    </Shell>
  );

  // ── STEP 4: Done ───────────────────────────────────────────────────────
  return (
    <Shell>
      <div className={styles.success}>
        <div className={styles.successIconWrap}>
          <CheckCircle2 size={36} color="#15803d" strokeWidth={2} />
        </div>
        <h1 className={styles.successTitle}>Password Reset!</h1>
        <p className={styles.successDesc}>
          Your password has been updated successfully. You can now sign in with your new password.
        </p>
        <Link href="/login" className={styles.successBtn}>
          Sign In <ArrowRight size={15} strokeWidth={2} />
        </Link>
        <Link href="/" className={styles.successBack}>Return to Home</Link>
      </div>
    </Shell>
  );
}