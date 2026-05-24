"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, User, Mail, Phone, CreditCard,
  MapPin, ChevronDown, ArrowRight,
  ShieldCheck, Check, X, UploadCloud, FileText, Trash2, RotateCcw
} from "lucide-react";
import styles from "./page.module.css";

const lgas = [
  "Mbo LGA", "Oron LGA", "Udung-Uko LGA", "Urue-Offong/Oruko LGA",
];

const days = Array.from({ length: 31 }, (_, i) => i + 1);
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 60 }, (_, i) => currentYear - i);

const MAX_FILE_SIZE = 2 * 1024 * 1024;

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

export default function RegisterPage() {
  const [step, setStep] = useState("register"); // "register" | "verify"
  const [verifyMethod, setVerifyMethod] = useState("email"); // "email" | "phone"
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputs = useRef([]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [certificate, setCertificate] = useState(null);
  const [certError, setCertError] = useState("");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    nin: "", dobDay: "", dobMonth: "", dobYear: "",
    gender: "", lga: "", password: "", confirm: "",
  });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  }

  function handleCertificateChange(e) {
    const file = e.target.files[0];
    setCertError("");
    if (!file) return;
    if (file.type !== "application/pdf") { setCertError("Only PDF files are allowed."); e.target.value = ""; return; }
    if (file.size > MAX_FILE_SIZE) { setCertError("File size must not exceed 2MB."); e.target.value = ""; return; }
    setCertificate(file);
  }

  function removeCertificate() { setCertificate(null); setCertError(""); }
  function formatFileSize(bytes) { return (bytes / 1024).toFixed(1) + " KB"; }

  function validate() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.nin.trim()) e.nin = "Required";
    else if (form.nin.length !== 11) e.nin = "Must be exactly 11 digits";

  if (!form.dobDay || !form.dobMonth || !form.dobYear) {
  e.dob = "Please select a complete date of birth";
  } else {
  const monthIndex = months.indexOf(form.dobMonth);
  const dob = new Date(Number(form.dobYear), monthIndex, Number(form.dobDay));
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  if (age < 18) e.dob = "You must be at least 18 years old to register.";
  }

    if (!form.gender) e.gender = "Required";
    if (!form.lga) e.lga = "Required";
    if (!form.password) e.password = "Required";
    else if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (!form.confirm) e.confirm = "Required";
    else if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    if (!certificate) e.certificate = "Certificate of Origin is required.";
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    // API call goes here
    setStep("verify");
    startCountdown();
  }

  function startCountdown() {
    setCountdown(60);
    setCanResend(false);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
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

  function handleResend() {
    if (!canResend) return;
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    startCountdown();
    inputs.current[0]?.focus();
    // Resend API call goes here
  }

  function handleOtpSubmit(e) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Please enter the complete 6-digit code."); return; }
    // Verify API call goes here
  }

  // ── VERIFY STEP ──────────────────────────────────────────────────────────
  if (step === "verify") {
    return (
      <div className={styles.page}>
        <div className={styles.main}>
          <div className={styles.card}>

            {/* LOGO */}
            <div className={styles.logoWrap}>
              <Link href="/" className={styles.logo}>
                <div className={styles.logoBox}><span className={styles.logoLetter}>R</span></div>
                <div className={styles.logoText}>
                  <span className={styles.logoName}>RMHCDT</span>
                  <span className={styles.logoSub}>Youth Portal</span>
                </div>
              </Link>
            </div>

            {/* HEADER */}
            <div className={styles.cardHeader}>
              <h1 className={styles.cardTitle}>Verify Account</h1>
              <p className={styles.cardSubtitle}>
                Choose how you want to receive your verification code.
              </p>
            </div>

            <form className={styles.form} onSubmit={handleOtpSubmit}>

              {/* METHOD TOGGLE */}
              <div className={styles.sectionLabel}>Verification Method</div>
              <div className={styles.verifyToggle}>
                <button
                  type="button"
                  onClick={() => { setVerifyMethod("email"); setOtp(["","","","","",""]); setOtpError(""); startCountdown(); }}
                  className={styles.verifyToggleBtn + (verifyMethod === "email" ? " " + styles.verifyToggleActive : "")}
                >
                  <Mail size={15} /> Email
                </button>
                <button
                  type="button"
                  onClick={() => { setVerifyMethod("phone"); setOtp(["","","","","",""]); setOtpError(""); startCountdown(); }}
                  className={styles.verifyToggleBtn + (verifyMethod === "phone" ? " " + styles.verifyToggleActive : "")}
                >
                  <Phone size={15} /> Phone
                </button>
              </div>

              <span className={styles.hint} style={{ textAlign: "center" }}>
                {verifyMethod === "email"
                  ? <>Code sent to <strong style={{ color: "#0f172a" }}>{form.email}</strong></>
                  : <>Code sent to <strong style={{ color: "#0f172a" }}>{form.phone}</strong></>
                }
              </span>

              {/* OTP INPUTS */}
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

              {otpError && <span className={styles.error} style={{ textAlign: "center" }}>{otpError}</span>}

              <span className={styles.hint} style={{ textAlign: "center" }}>
                {canResend ? (
                  <button type="button" onClick={handleResend} className={styles.resendBtn}>
                    <RotateCcw size={13} /> Resend Code
                  </button>
                ) : (
                  <>Resend code in <strong style={{ color: "#0f172a" }}>{countdown}s</strong></>
                )}
              </span>

              <button type="submit" className={styles.submitBtn}>
                Verify Account <ArrowRight size={15} strokeWidth={2} />
              </button>

              <button type="button" onClick={() => setStep("register")} className={styles.signinBtn}>
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

  // ── REGISTER STEP ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.card}>

          {/* LOGO */}
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

          {/* HEADER */}
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Create Account</h1>
            <p className={styles.cardSubtitle}>
              Join the portal to access scholarships, grants, training and funding.
            </p>
          </div>

          {/* FORM */}
          <form className={styles.form} onSubmit={handleSubmit}>

            {/* PERSONAL */}
            <div className={styles.sectionLabel}>Personal Information</div>
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
                  <input name="phone" value={form.phone} onChange={handleChange}
                  placeholder="08012345678" maxLength={11}
                  style={{ paddingLeft: "34px", paddingRight: "40px" }}
                  className={styles.input + (errors.phone ? " " + styles.inputError : "")} />
                  <span className={styles.ninCount}>{form.phone.length}/11</span>
                </div>
                {errors.phone && <span className={styles.error}>{errors.phone}</span>}
              </div>
            </div>

            {/* IDENTITY */}
            <div className={styles.sectionLabel}>Identity Verification</div>
            <div className={styles.field}>
              <label className={styles.label}>National Identification Number (NIN)</label>
              <div className={styles.inputWrap}>
                <CreditCard size={15} color="#94a3b8" className={styles.inputIcon} />
                <input name="nin" value={form.nin} onChange={handleChange}
                  placeholder="11-digit NIN" maxLength={11}
                  className={styles.input + (errors.nin ? " " + styles.inputError : "")} />
                <span className={styles.ninCount}>{form.nin.length}/11</span>
              </div>
              {errors.nin
                ? <span className={styles.error}>{errors.nin}</span>
                : <span className={styles.hint}>One NIN per account used to verify your identity.</span>}
            </div>

            {/* DATE OF BIRTH */}
            <div className={styles.field}>
              <label className={styles.label}>Date of Birth</label>
              <div className={styles.dobRow}>
                <div className={styles.inputWrap}>
                  <ChevronDown size={15} color="#94a3b8" className={styles.inputIconRight} />
                  <select name="dobDay" value={form.dobDay} onChange={handleChange}
                    className={styles.select + (errors.dob ? " " + styles.inputError : "")}>
                    <option value="">Day</option>
                    {days.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className={styles.inputWrap}>
                  <ChevronDown size={15} color="#94a3b8" className={styles.inputIconRight} />
                  <select name="dobMonth" value={form.dobMonth} onChange={handleChange}
                    className={styles.select + (errors.dob ? " " + styles.inputError : "")}>
                    <option value="">Month</option>
                    {months.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className={styles.inputWrap}>
                  <ChevronDown size={15} color="#94a3b8" className={styles.inputIconRight} />
                  <select name="dobYear" value={form.dobYear} onChange={handleChange}
                    className={styles.select + (errors.dob ? " " + styles.inputError : "")}>
                    <option value="">Year</option>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
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
                  <ChevronDown size={15} color="#94a3b8" className={styles.inputIconRight} />
                  <select name="lga" value={form.lga} onChange={handleChange}
                    className={styles.select + " " + styles.selectPadLeft + (errors.lga ? " " + styles.inputError : "")}>
                    <option value="">Select LGA</option>
                    {lgas.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                {errors.lga && <span className={styles.error}>{errors.lga}</span>}
              </div>
            </div>

            {/* DOCUMENTS */}
            <div className={styles.sectionLabel}>Documents</div>
            <div className={styles.field}>
              <label className={styles.label}>Certificate of Origin</label>
              {!certificate ? (
                <label className={styles.uploadArea + (errors.certificate ? " " + styles.inputError : "")}>
                  <input type="file" accept="application/pdf" onChange={handleCertificateChange} style={{ display: "none" }} />
                  <UploadCloud size={22} color="#94a3b8" />
                  <span className={styles.uploadTitle}>Click to upload PDF</span>
                  <span className={styles.uploadHint}>PDF only · Max 2MB</span>
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

            {/* SECURITY */}
            <div className={styles.sectionLabel}>Account Security</div>
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
              {errors.confirm
                ? <span className={styles.error}>{errors.confirm}</span>
                : form.confirm && form.password === form.confirm
                ? <span className={styles.matchHint}><Check size={12} strokeWidth={2.5} /> Passwords match</span>
                : null}
            </div>

            {/* TERMS */}
            <div className={styles.terms}>
              <p className={styles.termsText}>
                By creating an account you agree to our{" "}
                <Link href="#" className={styles.termsLink}>Terms of Use</Link>{" "}and{" "}
                <Link href="#" className={styles.termsLink}>Privacy Policy</Link>.
                You confirm all information provided is accurate and complete.
              </p>
            </div>

            <button type="submit" className={styles.submitBtn}>
              Create Account <ArrowRight size={15} strokeWidth={2} />
            </button>
          </form>

          {/* DIVIDER */}
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