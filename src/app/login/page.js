"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Mail, ArrowRight, ShieldCheck } from "lucide-react";
import styles from "../register/page.module.css";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  }

  function validate() {
    const e = {};
    if (!form.email.trim()) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Required";
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    // API call goes here
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
            <h1 className={styles.cardTitle}>Sign In</h1>
            <p className={styles.cardSubtitle}>
              Welcome back. Enter your credentials to continue.
            </p>
          </div>

          {/* FORM */}
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.sectionLabel}>Account Details</div>

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
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <input name="password" type={showPassword ? "text" : "password"}
                  value={form.password} onChange={handleChange}
                  placeholder="Enter your password"
                  className={styles.input + " " + styles.inputPadRight + (errors.password ? " " + styles.inputError : "")} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeBtn}>
                  {showPassword ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
                </button>
              </div>
              {errors.password && <span className={styles.error}>{errors.password}</span>}
            </div>

            <div style={{ textAlign: "right" }}>
              <Link href="/forgot-password" className={styles.signinTopLink}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" className={styles.submitBtn}>
              Sign In <ArrowRight size={15} strokeWidth={2} />
            </button>
          </form>

          {/* DIVIDER */}
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