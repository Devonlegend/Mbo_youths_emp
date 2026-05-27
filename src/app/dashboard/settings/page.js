"use client";
import { useState } from "react";
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

export default function SettingsPage() {
  /* ── Password ── */
  const [passwords, setPasswords] = useState({ newPass: "", confirm: "" });
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPwd,   setSavingPwd]   = useState(false);
  const [successPwd,  setSuccessPwd]  = useState(false);
  const [pwdError,    setPwdError]    = useState("");
  const [isEditingPwd, setIsEditingPwd] = useState(false);

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

  function handlePwd(e) {
    setPasswords((p) => ({ ...p, [e.target.name]: e.target.value }));
    setPwdError(""); setSuccessPwd(false);
  }

  function toggleNotif(key)   { setNotifs((n)  => ({ ...n, [key]: !n[key] })); }
  function togglePrivacy(key) { setPrivacy((p) => ({ ...p, [key]: !p[key] })); }

  async function handleSavePwd(e) {
    e.preventDefault();
    if (!isEditingPwd) { setIsEditingPwd(true); return; }
    if (passwords.newPass.length < 8) { setPwdError("Password must be at least 8 characters."); return; }
    if (passwords.newPass !== passwords.confirm) { setPwdError("Passwords do not match."); return; }
    setSavingPwd(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSavingPwd(false);
    setSuccessPwd(true);
    setIsEditingPwd(false);
    setPasswords({ newPass: "", confirm: "" });
  }

  return (
    <div className={styles.page}>

      {/* ── 1. CHANGE PASSWORD ── */}
      <div className={styles.card}>
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

        <div className={styles.cardBody}>
          {successPwd && (
            <div className={styles.successBanner}>
              <ShieldCheck size={14} strokeWidth={2} /> Password updated successfully.
            </div>
          )}
          {pwdError && <div className={styles.errorBanner}>{pwdError}</div>}

          <form className={styles.form} onSubmit={handleSavePwd}>
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
                    disabled={!isEditingPwd}
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
                    disabled={!isEditingPwd}
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
                className={isEditingPwd ? styles.btnPrimary : styles.btnOutline}
                disabled={savingPwd}
              >
                {!isEditingPwd
                  ? <><KeyRound size={14} strokeWidth={2} /> Edit password</>
                  : savingPwd
                    ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Updating...</>
                    : <><Save size={14} strokeWidth={2} /> Update password</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>

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