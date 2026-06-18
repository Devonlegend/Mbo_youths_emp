"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  IdCard, ShieldCheck, Camera, Save, Loader2,
  Lock, ChevronRight, User, Mail, Phone,
  MapPin, Calendar, Users, Pencil, X, AlertCircle,
  Banknote, Building2, Hash, CreditCard,
} from "lucide-react";
import styles from "./page.module.css";
import LoadingSpinner from "../components/LoadingSpinner";
import { getMe, getStudentProfile, updateStudentProfile } from "@/services";
import { getBankDetail, addBankDetail } from "@/services/students";

const NIGERIAN_BANKS = [
  "Access Bank", "Citibank Nigeria", "EcoBank Nigeria", "Fidelity Bank",
  "First Bank of Nigeria", "First City Monument Bank (FCMB)", "Globus Bank",
  "Guaranty Trust Bank (GTBank)", "Heritage Bank", "Keystone Bank",
  "Lotus Bank", "Optimus Bank", "Polaris Bank", "Providus Bank",
  "Stanbic IBTC Bank", "Standard Chartered Bank", "Sterling Bank",
  "SunTrust Bank", "Titan Trust Bank", "Union Bank of Nigeria",
  "United Bank for Africa (UBA)", "Unity Bank", "Wema Bank", "Zenith Bank",
];

function ReadField({ icon: Icon, label, value, dimmed }) {
  return (
    <div className={styles.field} style={dimmed ? { opacity: 0.4 } : {}}>
      <label className={styles.label}>
        {Icon && <Icon size={12} strokeWidth={2} />} {label}
      </label>
      <div className={styles.readValue}>{value || "—"}</div>
    </div>
  );
}

export default function ProfilePage() {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [apiError, setApiError] = useState("");
  const [photo,    setPhoto]    = useState(null);

  const [bankEditing, setBankEditing] = useState(false);
  const [bankSaving,  setBankSaving]  = useState(false);
  const [bankSaved,   setBankSaved]   = useState(false);
  const [bankError,   setBankError]   = useState("");
  const [bank,        setBank]        = useState({ bank_name: "", account_number: "", account_name: "" });
  const [bankDraft,   setBankDraft]   = useState({ ...bank });

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    dob: "", gender: "", lga: "", ward: "", nin_masked: "",
  });
  const [draft, setDraft] = useState({ ...form });

  const initials =
    (form.first_name?.[0]?.toUpperCase() || "") +
    (form.last_name?.[0]?.toUpperCase()  || "");

  useEffect(() => {
    async function loadProfile() {
      try {
        const [authRes, studentRes] = await Promise.all([getMe(), getStudentProfile()]);
        const auth    = authRes.data;
        const profile = studentRes.data;
        const loaded = {
          first_name: auth.firstname     || "",
          last_name:  auth.lastname      || "",
          email:      auth.email         || "",
          phone:      auth.phone_number  || "",
          dob:        auth.date_of_birth || "",
          gender:     auth.gender        || "",
          lga:        profile.lga        || "",
          ward:       profile.ward       || "",
          nin_masked: "****-****-****",
        };
        setForm(loaded);
        setDraft(loaded);
        if (auth.passport) setPhoto(auth.passport);
      } catch {
        setApiError("Failed to load profile. Please refresh.");
      } finally {
        setLoading(false);
      }
    }

    async function loadBank() {
      try {
        const res = await getBankDetail();
        if (res.data) {
          const b = {
            bank_name:      res.data.bank_name      || "",
            account_number: res.data.account_number || "",
            account_name:   res.data.account_name   || "",
          };
          setBank(b);
          setBankDraft(b);
        }
      } catch {}
    }

    loadProfile();
    loadBank();
  }, []);

  function handleDraftField(e) {
    setDraft((d) => ({ ...d, [e.target.name]: e.target.value }));
    setSaved(false);
    setApiError("");
  }

  function handleBankDraftField(e) {
    setBankDraft((d) => ({ ...d, [e.target.name]: e.target.value }));
    setBankSaved(false);
    setBankError("");
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (file) setPhoto(URL.createObjectURL(file));
  }

  function handleEdit() {
    setDraft({ ...form });
    setSaved(false);
    setApiError("");
    setEditing(true);
  }

  function handleCancel() {
    setDraft({ ...form });
    setEditing(false);
    setApiError("");
  }

  function handleBankEdit() {
    setBankDraft({ ...bank });
    setBankSaved(false);
    setBankError("");
    setBankEditing(true);
  }

  function handleBankCancel() {
    setBankDraft({ ...bank });
    setBankEditing(false);
    setBankError("");
  }

  async function handleSave(e) {
    e?.preventDefault();
    setSaving(true);
    setApiError("");
    try {
      await updateStudentProfile({ phone_number: draft.phone, email: draft.email });
      setForm((f) => ({ ...f, phone: draft.phone, email: draft.email }));
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setApiError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to save changes. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleBankSave(e) {
    e?.preventDefault();
    if (!bankDraft.bank_name)                       { setBankError("Please select a bank.");              return; }
    if (!/^\d{10}$/.test(bankDraft.account_number)) { setBankError("Account number must be 10 digits."); return; }
    if (!bankDraft.account_name.trim())              { setBankError("Account name is required.");          return; }

    setBankSaving(true);
    setBankError("");
    try {
      await addBankDetail(bankDraft);
      setBank({ ...bankDraft });
      setBankSaved(true);
      setBankEditing(false);
    } catch (err) {
      setBankError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to save bank details. Please try again."
      );
    } finally {
      setBankSaving(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className={styles.page}>

      {/* ── HERO ── */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.avatarWrap}>
            {photo ? (
              <img
                src={photo}
                alt="Passport"
                className={styles.avatarImg}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={styles.avatarInitials}
              style={{ display: photo ? 'none' : 'flex' }}
            >
              {initials}
            </div>
          </div>
          <div className={styles.heroMeta}>
            <h1 className={styles.heroName}>{form.first_name} {form.last_name}</h1>
            <p className={styles.heroEmail}>{form.email}</p>
          </div>
        </div>
      </div>

      {/* ── PERSONAL INFORMATION ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadIcon}>
            <User size={15} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className={styles.cardTitle}>Personal Information</h2>
            <p className={styles.cardSub}>Your registered profile details.</p>
          </div>
        </div>

        {apiError && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 13, color: "#dc2626", marginBottom: 4,
          }}>
            <AlertCircle size={14} strokeWidth={2} /> {apiError}
          </div>
        )}

        {saved && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 13, color: "#15803d", marginBottom: 4,
          }}>
            <ShieldCheck size={14} strokeWidth={2} /> Changes saved successfully
          </div>
        )}

        <div className={styles.form}>
          <div className={styles.row2}>
            <ReadField icon={User}     label="First Name"    value={form.first_name} dimmed={editing} />
            <ReadField icon={User}     label="Last Name"     value={form.last_name}  dimmed={editing} />
          </div>

          <div className={styles.row2}>
            {editing ? (
              <div className={styles.field}>
                <label className={styles.label}><Mail size={12} strokeWidth={2} /> Email Address</label>
                <input className={styles.input} name="email" type="email"
                  value={draft.email} onChange={handleDraftField} placeholder="Email" />
              </div>
            ) : (
              <ReadField icon={Mail} label="Email Address" value={form.email} />
            )}
            {editing ? (
              <div className={styles.field}>
                <label className={styles.label}><Phone size={12} strokeWidth={2} /> Phone Number</label>
                <input className={styles.input} name="phone"
                  value={draft.phone} onChange={handleDraftField} placeholder="+234..." />
              </div>
            ) : (
              <ReadField icon={Phone} label="Phone Number" value={form.phone} />
            )}
          </div>

          <div className={styles.row2}>
            <ReadField icon={Calendar} label="Date of Birth" value={form.dob}     dimmed={editing} />
            <ReadField icon={Users}    label="Gender"        value={form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : "—"} dimmed={editing} />
          </div>

          <div className={styles.row2}>
            <ReadField icon={MapPin} label="LGA"  value={form.lga}  dimmed={editing} />
            <ReadField icon={MapPin} label="Ward" value={form.ward} dimmed={editing} />
          </div>

          <ReadField icon={IdCard} label="National ID (NIN)" value={form.nin_masked} dimmed={editing} />
        </div>
      </div>

      {/* ── BANK DETAILS ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadIcon} style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <Banknote size={15} strokeWidth={2.2} color="#15803d" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className={styles.cardTitle}>Bank Details</h2>
            <p className={styles.cardSub}>
              {bank.bank_name
                ? "Your disbursement account."
                : "Add your bank account for disbursements."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {bankEditing && (
              <button type="button" className={styles.btnCancel} onClick={handleBankCancel}>
                <X size={13} strokeWidth={2} /> Cancel
              </button>
            )}
            <button
              type="button"
              className={styles.btnEdit}
              onClick={bankEditing ? handleBankSave : handleBankEdit}
              disabled={bankSaving}
            >
              {bankSaving ? (
                <><Loader2 size={13} strokeWidth={2} className={styles.spin} /> Saving...</>
              ) : bankEditing ? (
                <><Save size={13} strokeWidth={2} /> Update</>
              ) : (
                <><Pencil size={13} strokeWidth={2} /> {bank.bank_name ? "Edit" : "Add"}</>
              )}
            </button>
          </div>
        </div>

        {bankError && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 13, color: "#dc2626", marginBottom: 4,
          }}>
            <AlertCircle size={14} strokeWidth={2} /> {bankError}
          </div>
        )}

        {bankSaved && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 13, color: "#15803d", marginBottom: 4,
          }}>
            <ShieldCheck size={14} strokeWidth={2} /> Bank details saved successfully
          </div>
        )}

        <div className={styles.form}>
          {bankEditing ? (
            <>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}><Building2 size={12} strokeWidth={2} /> Bank Name</label>
                  <select className={styles.input} name="bank_name"
                    value={bankDraft.bank_name} onChange={handleBankDraftField}>
                    <option value="">Select bank</option>
                    {NIGERIAN_BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}><Hash size={12} strokeWidth={2} /> Account Number</label>
                  <input className={styles.input} name="account_number"
                    value={bankDraft.account_number} onChange={handleBankDraftField}
                    placeholder="10-digit account number" maxLength={10} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}><CreditCard size={12} strokeWidth={2} /> Account Name</label>
                <input className={styles.input} name="account_name"
                  value={bankDraft.account_name} onChange={handleBankDraftField}
                  placeholder="Name as it appears on your bank account" />
                <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  Must match your BVN-linked account name exactly.
                </span>
              </div>
            </>
          ) : bank.bank_name ? (
            <>
              <div className={styles.row2}>
                <ReadField icon={Building2} label="Bank Name"      value={bank.bank_name}      />
                <ReadField icon={Hash}      label="Account Number" value={bank.account_number} />
              </div>
              <ReadField icon={CreditCard} label="Account Name" value={bank.account_name} />
            </>
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "20px", gap: 8, textAlign: "center",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "#f8fafc", border: "1px solid #e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Banknote size={20} color="#cbd5e1" strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#64748b", margin: 0 }}>
                No bank details added yet
              </p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                Click Add to set up your disbursement account.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── SECURITY LINK ── */}
      <Link href="/dashboard/settings" className={styles.securityLink}>
        <div className={styles.securityLinkLeft}>
          <div className={styles.securityIcon}>
            <Lock size={16} strokeWidth={2.2} />
          </div>
          <div>
            <p className={styles.securityTitle}>Password &amp; Security</p>
            <p className={styles.securitySub}>Change your password and manage account security</p>
          </div>
        </div>
        <ChevronRight size={16} strokeWidth={2} className={styles.securityChevron} />
      </Link>

    </div>
  );
}