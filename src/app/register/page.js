"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, User, Mail, Phone, CreditCard,
  Calendar, MapPin, ChevronDown, ArrowRight,
  ShieldCheck, Check, X
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
  if (!password) return null;
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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

  function validate() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.nin.trim()) e.nin = "Required";
    else if (form.nin.length !== 11) e.nin = "Must be exactly 11 digits";
    if (!form.dobDay || !form.dobMonth || !form.dobYear) e.dob = "Please select a complete date of birth";
    if (!form.gender) e.gender = "Required";
    if (!form.lga) e.lga = "Required";
    if (!form.password) e.password = "Required";
    else if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (!form.confirm) e.confirm = "Required";
    else if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.success}>
              <div className={styles.successIconWrap}>
                <ShieldCheck size={36} color="#15803d" strokeWidth={1.5} />
              </div>
              <h2 className={styles.successTitle}>Account Created!</h2>
              <p className={styles.successDesc}>
                Your account has been successfully created.
                You can now sign in and start your application.
              </p>
              <Link href="/login" className={styles.successBtn}>
                Sign In Now <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <Link href="/" className={styles.successBack}>Back to Home</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                    placeholder="08012345678"
                    className={styles.input + (errors.phone ? " " + styles.inputError : "")} />
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
                : <span className={styles.hint}>One NIN per account — used to verify your identity.</span>}
            </div>

            {/* DATE OF BIRTH — 3 SELECTS */}
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
                    <option value="">Select gender</option>
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

            {/* SUBMIT */}
            <button type="submit" className={styles.submitBtn}>
              Create Account
              <ArrowRight size={15} strokeWidth={2} />
            </button>
          </form>

          {/* DIVIDER */}
          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>Already have an account?</span>
            <span className={styles.dividerLine} />
          </div>

          {/* SIGN IN */}
          <Link href="/login" className={styles.signinBtn}>
            Sign In to Your Account
          </Link>

          {/* BOTTOM BADGE */}
          <div className={styles.bottomBadge}>
            <ShieldCheck size={13} color="#15803d" strokeWidth={2} />
            <span>Secured under the Petroleum Industry Act, 2021</span>
          </div>

        </div>
      </div>
    </div>
  );
}