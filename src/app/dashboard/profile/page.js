"use client";
import Link from "next/link";
import { useState } from "react";
import {
  IdCard, ShieldCheck, CalendarDays, BadgeCheck,
  Camera, Save, Loader2, Lock, ChevronRight, User,
  Mail, Phone, MapPin, Calendar, Users, Pencil, X,
} from "lucide-react";
import styles from "./page.module.css";

const mockUser = {
  first_name:   "Chukwu",
  last_name:    "Harrison",
  email:        "c.harrison@mail.com",
  phone:        "+2348031234521",
  dob:          "1998-04-12",
  gender:       "Male",
  lga:          "Mbo LGA",
  ward:         "Eket Ward 2",
  nin_masked:   "**** **** 4521",
  status:       "Active",
  passport_photo: null,
};

export default function ProfilePage() {
  const [form, setForm] = useState({
    first_name: mockUser.first_name,
    last_name:  mockUser.last_name,
    email:      mockUser.email,
    phone:      mockUser.phone,
    dob:        mockUser.dob,
    gender:     mockUser.gender,
    lga:        mockUser.lga,
    ward:       mockUser.ward,
  });

  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [photo,   setPhoto]   = useState(mockUser.passport_photo);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState({ ...form });

  const initials =
    (form.first_name?.[0]?.toUpperCase() || "") +
    (form.last_name?.[0]?.toUpperCase()  || "");

  function handleDraftField(e) {
    setDraft((d) => ({ ...d, [e.target.name]: e.target.value }));
    setSaved(false);
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (file) setPhoto(URL.createObjectURL(file));
  }

  function handleEdit() {
    setDraft({ ...form });
    setSaved(false);
    setEditing(true);
  }

  function handleCancel() {
    setDraft({ ...form });
    setEditing(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1200));
    setForm({ ...draft });
    setSaving(false);
    setSaved(true);
    setEditing(false);
  }

  return (
    <div className={styles.page}>

      {/* ── HERO HEADER ── */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.avatarWrap}>
            {photo ? (
              <img src={photo} alt="Passport" className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarInitials}>{initials}</div>
            )}
            <label className={styles.avatarOverlay} htmlFor="photo-upload" title="Change photo">
              <Camera size={15} strokeWidth={2.2} />
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              className={styles.photoInput}
              onChange={handlePhoto}
            />
          </div>

          <div className={styles.heroMeta}>
            <h1 className={styles.heroName}>{form.first_name} {form.last_name}</h1>
            <p className={styles.heroEmail}>{form.email}</p>
          </div>
        </div>
      </div>

      {/* ── PHOTO REQUIREMENTS NOTE ── */}
      <div className={styles.photoNote}>
        <Camera size={13} strokeWidth={2} className={styles.photoNoteIcon} />
        <span>Passport photo must be clear, recent, on a plain background, face fully visible. JPG/PNG, max 2 MB.</span>
      </div>

      {/* ── PERSONAL INFORMATION FORM ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadIcon}>
            <User size={15} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className={styles.cardTitle}>Personal Information</h2>
            <p className={styles.cardSub}>Your registered profile details.</p>
          </div>
          {!editing ? (
            <button type="button" className={styles.btnEdit} onClick={handleEdit}>
              <Pencil size={13} strokeWidth={2} /> Edit
            </button>
          ) : (
            <button type="button" className={styles.btnCancel} onClick={handleCancel}>
              <X size={13} strokeWidth={2} /> Cancel
            </button>
          )}
        </div>

        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>
                <User size={12} strokeWidth={2} /> First name
              </label>
              <input
                className={styles.input}
                name="first_name"
                value={editing ? draft.first_name : form.first_name}
                onChange={handleDraftField}
                placeholder="First name"
                disabled={!editing}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                <User size={12} strokeWidth={2} /> Last name
              </label>
              <input
                className={styles.input}
                name="last_name"
                value={editing ? draft.last_name : form.last_name}
                onChange={handleDraftField}
                placeholder="Last name"
                disabled={!editing}
              />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>
                <Mail size={12} strokeWidth={2} /> Email address
              </label>
              <input
                className={styles.input}
                name="email"
                type="email"
                value={editing ? draft.email : form.email}
                onChange={handleDraftField}
                placeholder="Email"
                disabled={!editing}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                <Phone size={12} strokeWidth={2} /> Phone number
              </label>
              <input
                className={styles.input}
                name="phone"
                value={editing ? draft.phone : form.phone}
                onChange={handleDraftField}
                placeholder="+234..."
                disabled={!editing}
              />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>
                <Calendar size={12} strokeWidth={2} /> Date of birth
              </label>
              <input
                className={styles.input}
                name="dob"
                type="date"
                value={editing ? draft.dob : form.dob}
                onChange={handleDraftField}
                disabled={!editing}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                <Users size={12} strokeWidth={2} /> Gender
              </label>
              <select
                className={styles.input}
                name="gender"
                value={editing ? draft.gender : form.gender}
                onChange={handleDraftField}
                disabled={!editing}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>
                <MapPin size={12} strokeWidth={2} /> LGA
              </label>
              <input
                className={styles.input}
                name="lga"
                value={editing ? draft.lga : form.lga}
                onChange={handleDraftField}
                placeholder="LGA"
                disabled={!editing}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                <MapPin size={12} strokeWidth={2} /> Ward
              </label>
              <input
                className={styles.input}
                name="ward"
                value={editing ? draft.ward : form.ward}
                onChange={handleDraftField}
                placeholder="Ward"
                disabled={!editing}
              />
            </div>
          </div>

          {/* ── NIN (always read-only) ── */}
          <div className={styles.field}>
            <label className={styles.label}>
              <IdCard size={12} strokeWidth={2} /> National ID (NIN)
            </label>
            <input
              className={styles.input}
              value={mockUser.nin_masked}
              readOnly
              disabled
            />
          </div>

          {editing && (
            <div className={styles.formFoot}>
              {saved && (
                <span className={styles.savedMsg}>
                  <ShieldCheck size={13} strokeWidth={2} /> Changes saved
                </span>
              )}
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving
                  ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Saving...</>
                  : <><Save size={14} strokeWidth={2} /> Save changes</>
                }
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ── SECURITY LINK ── */}
      <Link href="/dashboard/settings" className={styles.securityLink}>
        <div className={styles.securityLinkLeft}>
          <div className={styles.securityIcon}><Lock size={16} strokeWidth={2.2} /></div>
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