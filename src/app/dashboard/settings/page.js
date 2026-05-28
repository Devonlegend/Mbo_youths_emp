"use client";
import { useState, useRef } from "react";
import {
  Eye, EyeOff, Save, Loader2, ShieldCheck,
  Bell, Globe, UserX, ChevronDown, ChevronUp,
  Smartphone, Mail, Megaphone, CalendarCheck, AlertTriangle, KeyRound, Check, X,
} from "lucide-react";
import styles from "./page.module.css";

function Section({ icon, title, sub, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.card}>
      <button className={styles.cardHead} onClick={() => setOpen((v) => !v)} type="button">
        <div className={styles.cardIcon}>{icon}</div>
        <div className={styles.cardHeadText}>
          <h2 className={styles.cardTitle}>{title}</h2>
          <p className={styles.cardSub}>{sub}</p>
        </div>
        {open
          ? <ChevronUp size={16} strokeWidth={2} className={styles.chevron} />
          : <ChevronDown size={16} strokeWidth={2} className={styles.chevron} />
        }
      </button>
      {open && <div className={styles.cardBody}>{children}</div>}
    </div>
  );
}

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

function ToggleRow({ icon, label, sub, checked, onChange }) {
  return (
    <label className={styles.toggleRow}>
      <div className={styles.toggleLeft}>
        {icon && <span className={styles.toggleIcon}>{icon}</span>}
        <div>
          <p className={styles.toggleLabel}>{label}</p>
          {sub && <p className={styles.toggleSub}>{sub}</p>}
        </div>
      </div>
      <div className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`} onClick={onChange}>
        <div className={styles.toggleThumb} />
      </div>
    </label>
  );
}

/* ── OTP INPUT ── */
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);

  function handleKey(e, i) {
    if (e.key === "Backspace" && !e.target.value && i > 0) {
      inputs.current[i - 1].focus();
    }
  }

  function handleChange(e, i) {
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[i] = val;
    const joined = next.join("");
    onChange(joined);
    if (val && i < 5) inputs.current[i + 1].focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, ""));
      const focusIdx = Math.min(pasted.length, 5);
      inputs.current[focusIdx]?.focus();
      e.preventDefault();
    }
  }

  return (
    <div className={styles.otpRow}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          className={styles.otpBox}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

/* ── PASSWORD & SECURITY CARD ── */
function PasswordCard() {
  const [passwords, setPasswords] = useState({ newPass: "", confirm: "" });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pwdError, setPwdError] = useState("");

  // OTP stage
  const [stage, setStage] = useState("form"); // "form" | "otp" | "success"
  const [otpChannel, setOtpChannel] = useState("phone"); // "phone" | "email"
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function handlePwd(e) {
    setPasswords((p) => ({ ...p, [e.target.name]: e.target.value }));
    setPwdError("");
  }

  function handleSubmitPwd(e) {
    e.preventDefault();
    if (!isEditing) { setIsEditing(true); return; }
    if (passwords.newPass.length < 8) { setPwdError("Password must be at least 8 characters."); return; }
    if (passwords.newPass !== passwords.confirm) { setPwdError("Passwords do not match."); return; }
    // Move to OTP stage
    setStage("otp");
    setOtp("");
    setOtpError("");
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) { setOtpError("Please enter all 6 digits."); return; }
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 1200));
    setVerifying(false);
    // Simulate success (any 6-digit code works in this demo)
    setStage("success");
    setTimeout(() => {
      setStage("form");
      setIsEditing(false);
      setPasswords({ newPass: "", confirm: "" });
      setOtp("");
    }, 2000);
  }

  async function handleResend() {
    setResending(true);
    setResent(false);
    await new Promise((r) => setTimeout(r, 900));
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 3000);
  }

  function handleCancelOtp() {
    setStage("form");
    setOtp("");
    setOtpError("");
  }

  return (
    <div className={styles.card}>
      {/* Header — always visible */}
      <div className={styles.pwdCardHead}>
        <div className={styles.pwdCardHeadLeft}>
          <div className={styles.cardIcon}><KeyRound size={17} strokeWidth={1.9} /></div>
          <div>
            <h2 className={styles.cardTitle}>Password &amp; Security</h2>
            <p className={styles.cardSub}>Set a strong password to keep your account safe.</p>
          </div>
        </div>
        <span className={styles.pwdBadge}>Security</span>
      </div>

      {/* ── FORM STAGE ── */}
      {stage === "form" && (
        <div className={styles.cardBody}>
          {pwdError && <div className={styles.errorBanner}>{pwdError}</div>}
          <form className={styles.form} onSubmit={handleSubmitPwd}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>New password</label>
                <div className={styles.pwdWrap}>
                  <input
                    className={styles.input}
                    name="newPass"
                    type={showNew ? "text" : "password"}
                    value={passwords.newPass}
                    onChange={handlePwd}
                    placeholder="Enter new password"
                    disabled={!isEditing}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowNew((v) => !v)}>
                    {showNew ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
                  </button>
                </div>
                <PasswordStrength password={passwords.newPass} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm new password</label>
                <div className={styles.pwdWrap}>
                  <input
                    className={styles.input}
                    name="confirm"
                    type={showConfirm ? "text" : "password"}
                    value={passwords.confirm}
                    onChange={handlePwd}
                    placeholder="Confirm password"
                    disabled={!isEditing}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm((v) => !v)}>
                    {showConfirm ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
                  </button>
                </div>
              </div>
            </div>
            <p className={styles.hint}>Minimum 8 characters. Use a mix of letters, numbers, and symbols.</p>
            <div className={styles.formFoot}>
              <button
                type="submit"
                className={isEditing ? styles.btnPrimary : styles.btnOutline}
              >
                {!isEditing
                  ? <><KeyRound size={14} strokeWidth={2} /> Edit password</>
                  : <><ShieldCheck size={14} strokeWidth={2} /> Continue</>
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── OTP STAGE ── */}
      {stage === "otp" && (
        <div className={`${styles.cardBody} ${styles.otpBody}`}>
          <div className={styles.otpHeader}>
            <div className={styles.otpIconWrap}>
              <ShieldCheck size={22} strokeWidth={1.8} color="#15803d" />
            </div>
            <div>
              <p className={styles.otpTitle}>Verify it's you</p>
              <p className={styles.otpDesc}>
                We'll send a 6-digit code to confirm this change.
              </p>
            </div>
          </div>

          {/* Channel picker */}
          <div className={styles.channelPicker}>
            <button
              type="button"
              className={`${styles.channelBtn} ${otpChannel === "phone" ? styles.channelBtnActive : ""}`}
              onClick={() => { setOtpChannel("phone"); setResent(false); }}
            >
              <Smartphone size={14} strokeWidth={2} />
              Phone
            </button>
            <button
              type="button"
              className={`${styles.channelBtn} ${otpChannel === "email" ? styles.channelBtnActive : ""}`}
              onClick={() => { setOtpChannel("email"); setResent(false); }}
            >
              <Mail size={14} strokeWidth={2} />
              Email
            </button>
          </div>

          <p className={styles.otpSentNote}>
            {otpChannel === "phone"
              ? "Code sent to your registered phone number"
              : "Code sent to your registered email address"}
          </p>

          {/* OTP boxes */}
          <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpError(""); }} />
          {otpError && <p className={styles.otpError}>{otpError}</p>}

          {/* Resend */}
          <div className={styles.resendRow}>
            {resent
              ? <span className={styles.resentMsg}><Check size={12} strokeWidth={2.5} /> Code resent!</span>
              : <button type="button" className={styles.resendBtn} onClick={handleResend} disabled={resending}>
                  {resending ? <><Loader2 size={12} className={styles.spin} /> Sending...</> : "Resend code"}
                </button>
            }
          </div>

          {/* Actions */}
          <div className={styles.otpActions}>
            <button type="button" className={styles.btnOutline} onClick={handleCancelOtp}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleVerifyOtp}
              disabled={verifying || otp.length < 6}
            >
              {verifying
                ? <><Loader2 size={14} className={styles.spin} /> Verifying...</>
                : <><ShieldCheck size={14} strokeWidth={2} /> Verify</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── SUCCESS STAGE ── */}
      {stage === "success" && (
        <div className={`${styles.cardBody} ${styles.successStage}`}>
          <div className={styles.successBanner}>
            <ShieldCheck size={14} strokeWidth={2} /> Password updated successfully.
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  /* ── Notifications ── */
  const [notifs, setNotifs] = useState({
    sms: true, email: true, announcements: true, events: false, cycleAlerts: true,
  });

  /* ── Privacy ── */
  const [privacy, setPrivacy] = useState({ showProfile: true, showPhone: false });

  /* ── Language ── */
  const [lang, setLang] = useState("en");

  /* ── Deactivate modal ── */
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  function toggleNotif(key)   { setNotifs((n)  => ({ ...n, [key]: !n[key] })); }
  function togglePrivacy(key) { setPrivacy((p) => ({ ...p, [key]: !p[key] })); }

  return (
    <div className={styles.page}>

      {/* ── 1. CHANGE PASSWORD ── */}
      <PasswordCard />

      {/* ── 2. NOTIFICATIONS ── */}
      <Section icon={<Bell size={17} strokeWidth={1.9} />} title="Notifications" sub="Choose how and when you receive alerts.">
        <div className={styles.toggleList}>
          <p className={styles.groupLabel}>Channels</p>
          <ToggleRow icon={<Smartphone size={14} strokeWidth={2} />} label="SMS notifications" sub="Receive updates via text message" checked={notifs.sms} onChange={() => toggleNotif("sms")} />
          <ToggleRow icon={<Mail size={14} strokeWidth={2} />} label="Email notifications" sub="Receive updates via email" checked={notifs.email} onChange={() => toggleNotif("email")} />
          <div className={styles.divider} />
          <p className={styles.groupLabel}>Topics</p>
          <ToggleRow icon={<Megaphone size={14} strokeWidth={2} />} label="Announcements" sub="Portal-wide news and updates" checked={notifs.announcements} onChange={() => toggleNotif("announcements")} />
          <ToggleRow icon={<CalendarCheck size={14} strokeWidth={2} />} label="Events" sub="Youth events and programmes" checked={notifs.events} onChange={() => toggleNotif("events")} />
          <ToggleRow icon={<ShieldCheck size={14} strokeWidth={2} />} label="Cycle alerts" sub="Reminders for your registration cycle" checked={notifs.cycleAlerts} onChange={() => toggleNotif("cycleAlerts")} />
        </div>
      </Section>

      {/* ── 3. PRIVACY ── */}
      <Section icon={<ShieldCheck size={17} strokeWidth={1.9} />} title="Privacy" sub="Control who can see your information.">
        <div className={styles.toggleList}>
          <ToggleRow label="Public profile" sub="Allow other members to view your profile" checked={privacy.showProfile} onChange={() => togglePrivacy("showProfile")} />
          <ToggleRow label="Show phone number" sub="Display your phone number on your profile" checked={privacy.showPhone} onChange={() => togglePrivacy("showPhone")} />
        </div>
      </Section>

      {/* ── 4. LANGUAGE & REGION ── */}
      <Section icon={<Globe size={17} strokeWidth={1.9} />} title="Language & Region" sub="Set your preferred language for the portal.">
        <div className={styles.field} style={{ maxWidth: 280 }}>
          <label className={styles.label}>Display language</label>
          <select className={styles.input} value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="en">English</option>
            <option value="ha">Hausa</option>
            <option value="yo">Yoruba</option>
            <option value="ig">Igbo</option>
            <option value="pcm">Nigerian Pidgin</option>
          </select>
        </div>
      </Section>

      {/* ── 5. ACCOUNT ── */}
      <Section icon={<UserX size={17} strokeWidth={1.9} />} title="Account" sub="Manage your account data and access.">
        <div className={styles.accountActions}>
          <div className={styles.actionRow}>
            <div>
              <p className={styles.actionTitle}>Download my data</p>
              <p className={styles.actionSub}>Export a copy of your profile and activity data.</p>
            </div>
            <button className={styles.btnOutline}>Download</button>
          </div>
          <div className={styles.divider} />
          <div className={styles.actionRowDanger}>
            <div>
              <p className={styles.actionTitle} style={{ color: "#dc2626" }}>Deactivate account</p>
              <p className={styles.actionSub}>Temporarily disable your account. You can reactivate anytime.</p>
            </div>
            <button className={styles.btnDanger} onClick={() => setShowDeactivateModal(true)}>Deactivate</button>
          </div>
        </div>
      </Section>

      {/* ── DEACTIVATE MODAL ── */}
      {showDeactivateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}>
              <AlertTriangle size={32} strokeWidth={1.8} color="#dc2626" />
            </div>
            <h3 className={styles.modalTitle}>Deactivate your account?</h3>
            <p className={styles.modalSub}>
              This will temporarily disable your account. You won't be able to log in until you reactivate it.
              Think twice — are you sure you want to proceed?
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnOutline} onClick={() => setShowDeactivateModal(false)}>
                Cancel, keep account
              </button>
              <button className={styles.btnDanger} onClick={() => setShowDeactivateModal(false)}>
                Yes, deactivate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}