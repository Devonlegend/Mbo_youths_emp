"use client";
import Link from "next/link";
import { useState, useEffect, type ChangeEvent, type SyntheticEvent } from "react";
import {
  IdCard, ShieldCheck, Save, Loader2,
  Lock, ChevronRight, User, Mail, Phone,
  MapPin, Calendar, Users, Pencil, X, AlertCircle,
  Banknote, Building2, Hash, CreditCard, CheckCircle2, GraduationCap, Layers, type LucideIcon,
} from "lucide-react";
import styles from "./page.module.css";
import LoadingSpinner from "../components/LoadingSpinner";
import { getMe, getStudentProfile, updateStudentProfile, getBanks, verifyBank } from "@/services";
import { getBankDetail, updateBankDetail, updateAcademicProfile } from "@/services/students";
import { isAxiosError } from "axios";
import type { Bank, ResolveBankResponse } from "@/types/verification";
import type { ProgrammeType } from "@/types/student";
import { PROGRAMME_TYPE_OPTIONS, DURATION_OPTIONS, programmeTypeLabel } from "@/constants/programme";

function getApiError(err: unknown): { error?: string; message?: string } {
  return isAxiosError<{ error?: string; message?: string }>(err) ? err.response?.data ?? {} : {};
}


interface AcademicState {
  faculty: string;
  programme_type: ProgrammeType | "";
  programme_duration_years: string; // "" when not set
  entry_level: string;              // "" when not set
}

const EMPTY_ACADEMIC: AcademicState = {
  faculty: "", programme_type: "", programme_duration_years: "", entry_level: "",
};

function academicFromProfile(p: {
  faculty: string;
  programme_type: ProgrammeType | "";
  programme_duration_years: number | null;
  entry_level: number | null;
}): AcademicState {
  return {
    faculty:                  p.faculty || "",
    programme_type:           p.programme_type || "",
    programme_duration_years: p.programme_duration_years != null ? String(p.programme_duration_years) : "",
    entry_level:              p.entry_level != null ? String(p.entry_level) : "",
  };
}

function yearsLabel(n: string): string {
  return n ? `${n} ${n === "1" ? "year" : "years"}` : "";
}

interface ReadFieldProps {
  icon?: LucideIcon;
  label: string;
  value?: string | null;
  dimmed?: boolean;
}

function ReadField({ icon: Icon, label, value, dimmed }: ReadFieldProps) {
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
  const [photo,    setPhoto]    = useState<string | null>(null);

  // Bank — saved display state
  const [bank, setBank] = useState({
    bank_name: "", bank_code: "", account_number: "", account_name: "",
  });

  // Bank — edit mode state
  const [bankEditing,     setBankEditing]     = useState(false);
  const [banks,           setBanks]           = useState<Bank[]>([]);   // from API
  const [bankCode,        setBankCode]        = useState("");
  const [accountDraft,    setAccountDraft]    = useState("");
  const [bankVerifying,   setBankVerifying]   = useState(false);
  const [bankVerified,    setBankVerified]    = useState<ResolveBankResponse | null>(null);
  const [bankSaved,       setBankSaved]       = useState(false);
  const [bankError,       setBankError]       = useState("");

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    dob: "", gender: "", lga: "", ward: "", nin_masked: "",
  });
  const [draft, setDraft] = useState({ ...form });

  // Academic information
  const [academic,        setAcademic]        = useState<AcademicState>(EMPTY_ACADEMIC);
  const [academicDraft,   setAcademicDraft]   = useState<AcademicState>(EMPTY_ACADEMIC);
  const [academicEditing, setAcademicEditing] = useState(false);
  const [academicSaving,  setAcademicSaving]  = useState(false);
  const [academicSaved,   setAcademicSaved]   = useState(false);
  const [academicError,   setAcademicError]   = useState("");

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
        const loadedAcademic = academicFromProfile(profile);
        setAcademic(loadedAcademic);
        setAcademicDraft(loadedAcademic);
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
          setBank({
            bank_name:      res.data.bank_name      || "",
            bank_code:      res.data.bank_code      || "",
            account_number: res.data.account_number || "",
            account_name:   res.data.account_name   || "",
          });
        }
      } catch {}
    }

    async function loadBanks() {
  try {
    const res = await getBanks();
    const rawBanks = Array.isArray(res.data?.banks) ? res.data.banks : [];
    setBanks(Array.from(new Map(rawBanks.map((b): [string, Bank] => [b.code, b])).values()));
  } catch {}
}

    loadProfile();
    loadBank();
    loadBanks();
  }, []);

  // ── PROFILE HANDLERS ──────────────────────────────────────────────────────
  function handleDraftField(e: ChangeEvent<HTMLInputElement>) {
    setDraft((d) => ({ ...d, [e.target.name]: e.target.value }));
    setSaved(false);
    setApiError("");
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

  async function handleSave(e?: SyntheticEvent) {
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
        getApiError(err).error ||
        getApiError(err).message ||
        "Failed to save changes. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  // ── BANK HANDLERS ─────────────────────────────────────────────────────────
  function handleBankEdit() {
    // Pre-fill from saved bank if one exists, so user sees what's there
    setBankCode(bank.bank_code || "");
    setAccountDraft(bank.account_number || "");
    setBankVerified(null);
    setBankSaved(false);
    setBankError("");
    setBankEditing(true);
  }

  function handleBankCancel() {
    setBankEditing(false);
    setBankVerified(null);
    setBankCode("");
    setAccountDraft("");
    setBankError("");
  }

  async function handleVerifyBank() {
    if (!bankCode) { setBankError("Please select a bank."); return; }
    if (!/^\d{10}$/.test(accountDraft)) {
      setBankError("Account number must be exactly 10 digits.");
      return;
    }

    setBankVerifying(true);
    setBankError("");
    setBankVerified(null);

    try {
      // verifyBank now auto-saves to the Student row on the backend,
      // so no separate PATCH call is needed after this.
      const res = await verifyBank({ account_number: accountDraft, bank_code: bankCode });
      setBankVerified(res.data);
    } catch (err) {
      setBankError(
        getApiError(err).error ||
        "Could not verify account. Please check the details and try again."
      );
    } finally {
      setBankVerifying(false);
    }
  }

  async function handleBankSave() {
    if (!bankVerified) return;
    // Paystack's resolve response only gives us bank_id, not a bank name —
    // so we look up the display name from the banks list using bankCode.
    const selectedBank = banks.find((b) => b.code === bankCode);

    try {
      await updateBankDetail({
        bank_name:      selectedBank?.name          || "",
        bank_code:      bankCode,
        account_number: bankVerified.account_number || accountDraft,
        account_name:   bankVerified.account_name   || "",
      });
      setBank({
        bank_name:      selectedBank?.name          || "",
        bank_code:      bankCode,
        account_number: bankVerified.account_number || accountDraft,
        account_name:   bankVerified.account_name   || "",
      });
      setBankSaved(true);
      setBankEditing(false);
      setBankVerified(null);
      setBankCode("");
      setAccountDraft("");
    } 
    catch (err) {
      setBankError(
        getApiError(err).error || "Failed to save bank details. Please try again."
      );
    }
  }


  // ── ACADEMIC HANDLERS ─────────────────────────────────────────────────────
  function handleAcademicEdit() {
    setAcademicDraft({ ...academic });
    setAcademicSaved(false);
    setAcademicError("");
    setAcademicEditing(true);
  }

  function handleAcademicCancel() {
    setAcademicDraft({ ...academic });
    setAcademicEditing(false);
    setAcademicError("");
  }

  function handleAcademicType(value: string) {
    // A new programme type makes the old duration and entry level invalid.
    setAcademicDraft((d) => ({
      ...d,
      programme_type: value as ProgrammeType | "",
      programme_duration_years: "",
      entry_level: "",
    }));
    setAcademicError("");
  }

  async function handleAcademicSave() {
    setAcademicSaving(true);
    setAcademicError("");
    try {
      const res = await updateAcademicProfile({
        faculty:                  academicDraft.faculty.trim(),
        programme_type:           academicDraft.programme_type,
        programme_duration_years: academicDraft.programme_duration_years ? Number(academicDraft.programme_duration_years) : null,
        entry_level:
          academicDraft.programme_type === "undergraduate" && academicDraft.entry_level
            ? Number(academicDraft.entry_level)
            : null,
      });
      const next = academicFromProfile(res.data);
      setAcademic(next);
      setAcademicDraft(next);
      setAcademicSaved(true);
      setAcademicEditing(false);
    } catch (err) {
      setAcademicError(
        getApiError(err).error ||
        getApiError(err).message ||
        "Failed to save academic details. Please try again."
      );
    } finally {
      setAcademicSaving(false);
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt="Passport"
                className={styles.avatarImg}
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'flex';
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
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {editing && (
              <button type="button" className={styles.btnCancel} onClick={handleCancel}>
                <X size={13} strokeWidth={2} /> Cancel
              </button>
            )}
            <button
              type="button"
              className={styles.btnEdit}
              onClick={editing ? handleSave : handleEdit}
              disabled={saving}
            >
              {saving ? (
                <><Loader2 size={13} strokeWidth={2} className={styles.spin} /> Saving...</>
              ) : editing ? (
                <><Save size={13} strokeWidth={2} /> Save</>
              ) : (
                <><Pencil size={13} strokeWidth={2} /> Edit</>
              )}
            </button>
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

      {/* ── ACADEMIC INFORMATION ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadIcon}>
            <GraduationCap size={15} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className={styles.cardTitle}>Academic Information</h2>
            <p className={styles.cardSub}>
              Used to calculate how many years a multi-year scholarship pays for.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {academicEditing && (
              <button type="button" className={styles.btnCancel} onClick={handleAcademicCancel}>
                <X size={13} strokeWidth={2} /> Cancel
              </button>
            )}
            <button
              type="button"
              className={styles.btnEdit}
              onClick={academicEditing ? handleAcademicSave : handleAcademicEdit}
              disabled={academicSaving}
            >
              {academicSaving ? (
                <><Loader2 size={13} strokeWidth={2} className={styles.spin} /> Saving...</>
              ) : academicEditing ? (
                <><Save size={13} strokeWidth={2} /> Save</>
              ) : (
                <><Pencil size={13} strokeWidth={2} /> Edit</>
              )}
            </button>
          </div>
        </div>

        {academicError && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 13, color: "#dc2626", marginBottom: 4,
          }}>
            <AlertCircle size={14} strokeWidth={2} /> {academicError}
          </div>
        )}

        {academicSaved && !academicEditing && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 13, color: "#15803d", marginBottom: 4,
          }}>
            <ShieldCheck size={14} strokeWidth={2} /> Academic details saved
          </div>
        )}

        <div className={styles.form}>
          {academicEditing ? (
            <>
              <div className={styles.field}>
                <label className={styles.label}><Building2 size={12} strokeWidth={2} /> Faculty</label>
                <input
                  className={styles.input}
                  value={academicDraft.faculty}
                  onChange={(e) => setAcademicDraft((d) => ({ ...d, faculty: e.target.value }))}
                  placeholder="e.g. Engineering, Medicine"
                />
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}><GraduationCap size={12} strokeWidth={2} /> Programme Type</label>
                  <select
                    className={styles.input}
                    value={academicDraft.programme_type}
                    onChange={(e) => handleAcademicType(e.target.value)}
                  >
                    <option value="">Select programme type</option>
                    {PROGRAMME_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}><Calendar size={12} strokeWidth={2} /> Programme Duration</label>
                  <select
                    className={styles.input}
                    value={academicDraft.programme_duration_years}
                    disabled={!academicDraft.programme_type}
                    onChange={(e) => setAcademicDraft((d) => ({ ...d, programme_duration_years: e.target.value }))}
                  >
                    <option value="">
                      {academicDraft.programme_type ? "Select duration" : "Choose a programme type first"}
                    </option>
                    {academicDraft.programme_type &&
                      DURATION_OPTIONS[academicDraft.programme_type].map((n) => (
                        <option key={n} value={String(n)}>{yearsLabel(String(n))}</option>
                      ))}
                  </select>
                </div>
              </div>

              {academicDraft.programme_type === "undergraduate" && (
                <div className={styles.field}>
                  <label className={styles.label}><Layers size={12} strokeWidth={2} /> Entry Level</label>
                  <select
                    className={styles.input}
                    value={academicDraft.entry_level}
                    onChange={(e) => setAcademicDraft((d) => ({ ...d, entry_level: e.target.value }))}
                  >
                    <option value="">Select entry level</option>
                    <option value="100">100 level (regular admission)</option>
                    <option value="200">200 level (direct entry)</option>
                  </select>
                </div>
              )}
            </>
          ) : (
            <>
              <ReadField icon={Building2} label="Faculty" value={academic.faculty} />
              <div className={styles.row2}>
                <ReadField
                  icon={GraduationCap}
                  label="Programme Type"
                  value={academic.programme_type ? programmeTypeLabel(academic.programme_type) : ""}
                />
                <ReadField
                  icon={Calendar}
                  label="Programme Duration"
                  value={yearsLabel(academic.programme_duration_years)}
                />
              </div>
              {academic.programme_type === "undergraduate" && (
                <ReadField
                  icon={Layers}
                  label="Entry Level"
                  value={
                    academic.entry_level === "200" ? "200 level (direct entry)"
                    : academic.entry_level ? `${academic.entry_level} level`
                    : ""
                  }
                />
              )}
            </>
          )}
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
            {!bankEditing && (
              <button type="button" className={styles.btnEdit} onClick={handleBankEdit}>
                <Pencil size={13} strokeWidth={2} /> {bank.bank_name ? "Edit" : "Add"}
              </button>
            )}
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

        {bankSaved && !bankEditing && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 13, color: "#15803d", marginBottom: 4,
          }}>
            <ShieldCheck size={14} strokeWidth={2} /> Bank details verified and saved
          </div>
        )}

        <div className={styles.form}>
          {bankEditing ? (
            <>
              {/* Bank select + account number */}
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}><Building2 size={12} strokeWidth={2} /> Bank</label>
                  <select
                    className={styles.input}
                    value={bankCode}
                    onChange={(e) => {
                      setBankCode(e.target.value);
                      setBankVerified(null);
                      setBankError("");
                    }}
                  >
                    <option value="">Select bank</option>
                    {banks.map((b) => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}><Hash size={12} strokeWidth={2} /> Account Number</label>
                  <input
                    className={styles.input}
                    value={accountDraft}
                    onChange={(e) => {
                      setAccountDraft(e.target.value);
                      setBankVerified(null);
                      setBankError("");
                    }}
                    placeholder="10-digit account number"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Verify button — only shown before verification */}
              {!bankVerified && (
                <button
                  type="button"
                  onClick={handleVerifyBank}
                  disabled={bankVerifying}
                  style={{
                    marginTop: 4, display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 20px", borderRadius: 9, border: "1px solid #bbf7d0",
                    background: "#f0fdf4", color: "#15803d", fontSize: 13,
                    fontWeight: 600, cursor: bankVerifying ? "not-allowed" : "pointer",
                    opacity: bankVerifying ? 0.7 : 1,
                  }}
                >
                  {bankVerifying ? (
                    <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Verifying...</>
                  ) : (
                    "Verify Account"
                  )}
                </button>
              )}

              {/* Verification result */}
              {bankVerified && (
                <div style={{
                  marginTop: 12, padding: "12px 16px", borderRadius: 10,
                  background: bankVerified.name_match?.passed ? "#f0fdf4" : "#fffbeb",
                  border: `1px solid ${bankVerified.name_match?.passed ? "#bbf7d0" : "#fde68a"}`,
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2
                      size={15}
                      color={bankVerified.name_match?.passed ? "#15803d" : "#b45309"}
                      strokeWidth={2}
                    />
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: bankVerified.name_match?.passed ? "#15803d" : "#b45309",
                    }}>
                      {bankVerified.account_name}
                    </span>
                  </div>
                  {!bankVerified.name_match?.passed && (
                    <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
                      Name does not match your registered name. You must verify an account registered in your own name before you can save it.
                    </p>
                  )}
                  {/* <button
                    type="button"
                    onClick={() => {
                      setBankVerified(null);
                      setBankCode("");
                      setAccountDraft("");
                      setBankError("");
                    }}
                    style={{
                      alignSelf: "flex-start", fontSize: 12, color: "#64748b",
                      background: "none", border: "none", cursor: "pointer",
                      padding: 0, textDecoration: "underline",
                    }}
                  >
                    Use a different account
                  </button> */}
                </div>
              )}

              {/* Hint — only shown before verification */}
              {!bankVerified && (
                <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "block" }}>
                  Verify your account — the name must match your BVN-linked account.
                </span>
              )}

              {/* Save to Profile — appears below everything else, only once verified & name matches */}
              {bankVerified && bankVerified.name_match?.passed && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                  <button type="button" className={styles.btnEdit} onClick={handleBankSave}>
                    <Save size={13} strokeWidth={2} /> Save to Profile
                  </button>
                </div>
              )}
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
