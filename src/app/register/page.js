"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, User, Mail, Phone, CreditCard,
  MapPin, ChevronDown, ArrowRight,
  ShieldCheck, Check, X, UploadCloud, FileText, AlertCircle, Trash2, RotateCcw, UserCheck, Fingerprint, FolderOpen
} from "lucide-react";
import styles from "./page.module.css";
import PassportCapture from "@/components/PassportCapture";
import { register, otpSend, otpVerify, otpResend } from "@/services/auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/* ─── Password Strength — logic unchanged, styling via CSS vars ─────────── */
function PasswordStrength({ password }) {
  const checks = [
    { label: "At least 8 characters", pass: password.length >= 8 },
    { label: "Contains a number", pass: /\d/.test(password) },
    { label: "Contains a letter", pass: /[a-zA-Z]/.test(password) },
    { label: "Contains a special character", pass: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const strength = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
  const colors = { Weak: "#ef4444", Fair: "#f59e0b", Good: "#3b82f6", Strong: "#15803d" };
  if (!password || score === 4) return null;
  return (
    <div className={styles.strengthWrap}>
      <div className={styles.strengthRow}>
        <div className={styles.strengthBars}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.strengthBar}
              style={{ background: i <= score ? colors[strength] : "#e2e8f0" }} />
          ))}
        </div>
        <span className={styles.strengthLabel} style={{ color: colors[strength] }}>{strength}</span>
      </div>
      <div className={styles.checkList}>
        {checks.map((c, i) => (
          <div key={i} className={styles.checkItem}>
            {c.pass
              ? <Check size={12} color="#15803d" strokeWidth={2.5} />
              : <X size={12} color="#cbd5e1" strokeWidth={2.5} />
            }
            <span style={{ color: c.pass ? "#374151" : "#94a3b8" }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Modern spinner used in buttons ────────────────────────────────────── */
function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function RegisterPage() {
  const [step, setStep] = useState("register");
  const [verifyMethod, setVerifyMethod] = useState("email");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const countdownRef = useRef(null);
  const inputs = useRef([]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [certificate, setCertificate] = useState(null);
  const [passport, setPassport] = useState(null);
  const [certError, setCertError] = useState("");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    nin: "", dob: "", gender: "", lga: "", ward: "",
    password: "", confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  }

function handleCertificateChange(e) {
  const file = e.target.files[0];
  setCertError("");
  if (!file) return;
  const allowed = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowed.includes(file.type)) {
    setCertError("Only PDF, JPG or PNG files are allowed.");
    e.target.value = "";
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    setCertError("File size must not exceed 5MB.");
    e.target.value = "";
    return;
  }
  setCertificate(file);
  setErrors((prev) => ({ ...prev, certificate: "" }));
}

  function removeCertificate() { setCertificate(null); setCertError(""); }
  function formatFileSize(bytes) { return (bytes / 1024).toFixed(1) + " KB"; }

  function dismissKeyboard(e) {
    if (e.target === e.currentTarget) document.activeElement?.blur();
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

  function validate() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.phone.trim()) e.phone = "Required";
    else if (!/^0[789][01]\d{8}$/.test(form.phone)) e.phone = "Enter a valid Nigerian phone number";
    if (!form.nin.trim()) e.nin = "Required";
    else if (form.nin.length !== 11) e.nin = "Must be exactly 11 digits";
    if (!form.dob) {
      e.dob = "Date of birth is required";
    } else {
      const dob = new Date(form.dob);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      if (age < 18) e.dob = "You must be at least 18 years old to register.";
    }
    if (!form.gender) e.gender = "Required";
    if (!form.lga.trim()) e.lga = "Required";
    if (!form.ward.trim()) e.ward = "Required";
    if (!passport) e.passport = "Passport photo is required.";
    if (!form.password) e.password = "Required";
    else if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (!form.confirm) e.confirm = "Required";
    else if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    return e;
  }

  /* API logic — untouched */
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    setApiError("");

    try {
      const formData = new FormData();
      formData.append("firstname", form.firstName);
      formData.append("lastname", form.lastName);
      formData.append("email", form.email);
      formData.append("phone_number", form.phone);

      // nin hashed
      const ninBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(form.nin));
      const fullHash = Array.from(new Uint8Array(ninBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      const ninHash = fullHash.slice(0, 20);
      formData.append("nin_hash", ninHash);

      formData.append("date_of_birth", form.dob);
      formData.append("gender", form.gender);
      formData.append("ward", form.ward);
      formData.append("lga", form.lga);
      formData.append("password", form.password);
      if (passport) formData.append("passport", passport);
      if (certificate) formData.append("certificate", certificate);

      await register(formData);
      await otpSend({ email: form.email });

      setStep("verify");
      startCountdown();
    } catch (err) {
      setApiError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Something went wrong. Please try again."
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

  async function handleOtpSubmit(e) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Please enter the complete 6-digit code."); return; }

    setLoading(true);
    setOtpError("");

    try {
      await otpVerify({ email: form.email, code });
      setStep("success");
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

  async function handleResend() {
    if (!canResend) return;
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    startCountdown();
    inputs.current[0]?.focus();

    try {
      await otpResend({ email: form.email });
    } catch (err) {
      setOtpError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to resend code. Please try again."
      );
    }
  }

  /* ── Logo block (reused across steps) ──────────────────────────────────── */
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

  /* ── SUCCESS ────────────────────────────────────────────────────────────── */
  if (step === "success") {
    return (
      <div className={styles.page}>
        <div className={styles.main}>
          <div className={styles.card}>
            <Logo />
            <div className={styles.success}>
              <div className={styles.successIconWrap}>
                <Check size={32} color="#15803d" strokeWidth={2.5} />
              </div>
              <h1 className={styles.successTitle}>Account Created!</h1>
              <p className={styles.successDesc}>
                Your account has been verified and is ready to use. You can now access scholarships,
                grants, training, and funding opportunities.
              </p>
              <Link href="/login" className={styles.successBtn}>
                Sign In to Your Account <ArrowRight size={15} strokeWidth={2} />
              </Link>
              <Link href="/" className={styles.successBack}>Back to Home</Link>
            </div>
            <div className={styles.bottomBadge}>
              <ShieldCheck size={13} color="#15803d" strokeWidth={2} />
              <span>Secured under the Petroleum Industry Act, 2021</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── VERIFY (OTP) — email only, modern layout ───────────────────────────── */
  if (step === "verify") {
    return (
      <div className={styles.page}>
        <div className={styles.main}>
          <div className={styles.card}>
            <Logo />

            {/* Clean OTP header — icon + title + subtitle */}
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
              {/* OTP inputs */}
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
                    className={
                      styles.otpInput + (otpError ? " " + styles.inputError : "")
                    }
                  />
                ))}
              </div>

              {otpError && (
                <span className={styles.error} style={{ textAlign: "center" }}>{otpError}</span>
              )}

              {/* Resend row */}
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

              {/* Verify button */}
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <><Spinner /> Verifying…</>
                ) : (
                  <><ShieldCheck size={15} strokeWidth={2} /> Verify Account</>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep("register")}
                className={styles.signinBtn}
              >
                Back to Registration
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

  /* ── REGISTER ───────────────────────────────────────────────────────────── */
  return (
    <div className={styles.page} onTouchStart={dismissKeyboard}>
      <div className={styles.main}>
        <div className={styles.card}>
          <Logo />

          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Create Account</h1>
            <p className={styles.cardSubtitle}>
              Join the portal to access scholarships, grants, training and funding.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>

            {apiError && (
              <div className={styles.apiBanner}>
                <AlertCircle size={16} color="#dc2626" strokeWidth={2} />
                {apiError}
              </div>
            )}

            {/* ── PERSONAL INFORMATION ───────────────────────────────────── */}
            {/* Section label: no green background — just a small line + text */}
            <div className={styles.sectionLabel}><UserCheck size={13} color="#15803d" strokeWidth={2.5} />Personal Information</div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>First Name</label>
                <div className={styles.inputWrap}>
                  <User size={15} color="#94a3b8" className={styles.inputIcon} />
                  <input name="firstName" value={form.firstName} onChange={handleChange}
                    placeholder="First name"
                    className={styles.input + (errors.firstName ? " " + styles.inputError : "")} />
                </div>
                {errors.firstName && <span className={styles.error}>{errors.firstName}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Last Name</label>
                <div className={styles.inputWrap}>
                  <User size={15} color="#94a3b8" className={styles.inputIcon} />
                  <input name="lastName" value={form.lastName} onChange={handleChange}
                    placeholder="Last name"
                    className={styles.input + (errors.lastName ? " " + styles.inputError : "")} />
                </div>
                {errors.lastName && <span className={styles.error}>{errors.lastName}</span>}
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Email Address</label>
                <div className={styles.inputWrap}>
                  <Mail size={15} color="#94a3b8" className={styles.inputIcon} />
                  <input name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="your@email.com"
                    className={styles.input + (errors.email ? " " + styles.inputError : "")} />
                </div>
                {errors.email && <span className={styles.error}>{errors.email}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Phone Number</label>
                <div className={styles.inputWrap}>
                  <Phone size={15} color="#94a3b8" className={styles.inputIcon} />
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setForm({ ...form, phone: val });
                      setErrors({ ...errors, phone: "" });
                    }}
                    placeholder="08012345678"
                    maxLength={11}
                    inputMode="numeric"
                    style={{ paddingLeft: "36px", paddingRight: "40px" }}
                    className={styles.input + (errors.phone ? " " + styles.inputError : "")}
                  />
                  <span className={styles.ninCount}>{form.phone.length}/11</span>
                </div>
                {errors.phone && <span className={styles.error}>{errors.phone}</span>}
              </div>
            </div>

            {/* ── IDENTITY VERIFICATION ──────────────────────────────────── */}
            <div className={styles.sectionLabel}><Fingerprint size={13} color="#15803d" strokeWidth={2.5} />Identity Verification</div>

            <div className={styles.field}>
              <label className={styles.label}>National Identification Number (NIN)</label>
              <div className={styles.inputWrap}>
                <CreditCard size={15} color="#94a3b8" className={styles.inputIcon} />
                <input
                  name="nin"
                  value={form.nin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setForm({ ...form, nin: val });
                    setErrors({ ...errors, nin: "" });
                  }}
                  placeholder="11-digit NIN"
                  maxLength={11}
                  inputMode="numeric"
                  className={styles.input + (errors.nin ? " " + styles.inputError : "")}
                />
                <span className={styles.ninCount}>{form.nin.length}/11</span>
              </div>
              {errors.nin
                ? <span className={styles.error}>{errors.nin}</span>
                : <span className={styles.hint}>One NIN per account — used to verify your identity.</span>
              }
            </div>

            {/* DATE OF BIRTH */}
            <div className={styles.field}>
              <label className={styles.label}>Date of Birth</label>
              <div className={styles.inputWrap}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.inputIcon}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <input
                  name="dob"
                  type="date"
                  value={form.dob}
                  onChange={handleChange}
                  max={new Date().toISOString().split("T")[0]}
                  className={styles.input + " " + styles.inputDate + (errors.dob ? " " + styles.inputError : "")}
                />
              </div>
              {errors.dob && <span className={styles.error}>{errors.dob}</span>}
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Gender</label>
                <div className={styles.inputWrap}>
                  <ChevronDown size={15} color="#94a3b8" className={styles.inputIconRight} />
                  <select name="gender" value={form.gender} onChange={handleChange}
                    className={styles.select + (errors.gender ? " " + styles.inputError : "")}>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                {errors.gender && <span className={styles.error}>{errors.gender}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Local Government Area</label>
                <div className={styles.inputWrap}>
                  <MapPin size={15} color="#94a3b8" className={styles.inputIcon} />
                  <input
                    name="lga"
                    value={form.lga}
                    onChange={handleChange}
                    placeholder="Enter your LGA"
                    className={styles.input + (errors.lga ? " " + styles.inputError : "")}
                  />
                </div>
                {errors.lga && <span className={styles.error}>{errors.lga}</span>}
              </div>
            </div>

            <div className={styles.field}>
            <label className={styles.label}>Ward</label>
            <div className={styles.inputWrap}>
              <MapPin size={15} color="#94a3b8" className={styles.inputIcon} />
              <ChevronDown size={15} color="#94a3b8" className={styles.inputIconRight} />
              <select
                name="ward"
                value={form.ward}
                onChange={handleChange}
                className={styles.select + " " + styles.selectPadLeft + (errors.ward ? " " + styles.inputError : "")}
              >
                <option value="">Select Ward</option>
                <option value="efiat">Efiat</option>
                <option value="efiat II">Efiat II</option>
                <option value="enwang I">Enwang I</option>
                <option value="enwang II">Enwang II</option>
                <option value="ebughu I">Ebughu I</option>
                <option value="ebughu II">Ebughu II</option>
                <option value="ibaka">Ibaka</option>
                <option value="uda I">Uda I</option>
                <option value="uda II">Uda II</option>
                <option value="udesi">Udesi</option>
              </select>
            </div>
            {errors.ward && <span className={styles.error}>{errors.ward}</span>}
          </div>

            {/* ── DOCUMENTS ──────────────────────────────────────────────── */}
            <div className={styles.sectionLabel}><FolderOpen size={13} color="#15803d" strokeWidth={2.5} />Documents</div>

            {/* Passport Photo — PassportCapture component kept as-is */}
            <div className={styles.field}>
              <label className={styles.label}>Passport Photo</label>
              <PassportCapture
                value={passport}
                onChange={(file) => {
                  setPassport(file);
                  setErrors((prev) => ({ ...prev, passport: "" }));
                }}
                error={errors.passport}
              />
              {!passport && !errors.passport && (
                <span className={styles.hint}>
                  A clear front-facing photo · Used for identity verification only
                </span>
              )}
            </div>

            {/* Certificate of Origin */}
            <div className={styles.field}>
              <label className={styles.label}>Certificate of Origin</label>
              {!certificate ? (
                <label className={styles.uploadArea + (errors.certificate ? " " + styles.inputError : "")}>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={handleCertificateChange}
                    style={{ display: "none" }}
                  />
                  <UploadCloud size={22} color="#94a3b8" />
                  <span className={styles.uploadTitle}>Click to upload</span>
                  <span className={styles.uploadHint}>PDF, JPG or PNG · Max 5MB</span>
                </label>
              ) : (
                <div className={styles.filePreview}>
                  <FileText size={20} color="#15803d" />
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{certificate.name}</span>
                    <span className={styles.fileSize}>{formatFileSize(certificate.size)}</span>
                  </div>
                  <button type="button" onClick={removeCertificate} className={styles.fileRemove}>
                    <Trash2 size={15} color="#ef4444" />
                  </button>
                </div>
              )}
              {certError && <span className={styles.error}>{certError}</span>}
              {errors.certificate && !certError && <span className={styles.error}>{errors.certificate}</span>}
            </div>

            {/* ── ACCOUNT SECURITY ───────────────────────────────────────── */}
            <div className={styles.sectionLabel}><ShieldCheck size={13} color="#15803d" strokeWidth={2.5} />Account Security</div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <input name="password" type={showPassword ? "text" : "password"}
                  value={form.password} onChange={handleChange}
                  placeholder="Create a strong password"
                  className={styles.input + " " + styles.inputPadRight + (errors.password ? " " + styles.inputError : "")} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeBtn}>
                  {showPassword ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
                </button>
              </div>
              {errors.password && <span className={styles.error}>{errors.password}</span>}
              <PasswordStrength password={form.password} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Confirm Password</label>
              <div className={styles.inputWrap}>
                <input name="confirm" type={showConfirm ? "text" : "password"}
                  value={form.confirm} onChange={handleChange}
                  placeholder="Re-enter your password"
                  className={styles.input + " " + styles.inputPadRight + (errors.confirm ? " " + styles.inputError : "")} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className={styles.eyeBtn}>
                  {showConfirm ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
                </button>
              </div>
              {errors.confirm && <span className={styles.error}>{errors.confirm}</span>}
              {!errors.confirm && form.confirm && form.password === form.confirm && (
                <span className={styles.matchHint}>
                  <Check size={12} strokeWidth={2.5} /> Passwords match
                </span>
              )}
            </div>

            {/* TERMS — neutral background, no green tint */}
            <div className={styles.terms}>
              <p className={styles.termsText}>
                By creating an account you agree to our{" "}
                <Link href="#" className={styles.termsLink}>Terms of Use</Link>{" "}and{" "}
                <Link href="#" className={styles.termsLink}>Privacy Policy</Link>.
                You confirm all information provided is accurate and complete.
              </p>
            </div>

            {/* Submit — modern spinner when loading */}
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <><Spinner /> Creating Account…</>
              ) : (
                <>Create Account <ArrowRight size={15} strokeWidth={2} /></>
              )}
            </button>

          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>Already have an account?</span>
            <span className={styles.dividerLine} />
          </div>

          <Link href="/login" className={styles.signinBtn}>
            Sign In to Your Account
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