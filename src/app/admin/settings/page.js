"use client";
import { useState, useEffect } from "react";
import {
  User, Mail, Phone, Lock, Eye, EyeOff,
  Save, Loader2, ShieldCheck, AlertCircle,
  Users, Plus, X, ChevronDown, Check,
  Shield, ShieldAlert, UserX, Settings, UserCheck, RefreshCw,
} from "lucide-react";
import styles from "./page.module.css";
import { getMe, getAdminUsers, createAdminUser, updateUserRole, deactivateUser, reactivateUser } from "@/services/auth";
import { getSchemes, getStudents, getApplications } from "@/services";

// ── PASSWORD STRENGTH ─────────────────────────────────────────────────────────
function PasswordStrength({ password }) {
  const checks = [
    { label: "At least 8 characters",      pass: password.length >= 8 },
    { label: "Contains a number",           pass: /\d/.test(password) },
    { label: "Contains a letter",           pass: /[a-zA-Z]/.test(password) },
    { label: "Contains a special character",pass: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score    = checks.filter((c) => c.pass).length;
  const strength = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
  const colors   = { Weak: "#ef4444", Fair: "#f59e0b", Good: "#3b82f6", Strong: "#15803d" };
  if (!password || score === 4) return null;
  return (
    <div className={styles.strengthWrap}>
      <div className={styles.strengthBars}>
        {[1,2,3,4].map((i) => (
          <div key={i} className={styles.strengthBar}
            style={{ background: i <= score ? colors[strength] : "#e2e8f0" }} />
        ))}
        <span className={styles.strengthLabel} style={{ color: colors[strength] }}>
          {strength}
        </span>
      </div>
    </div>
  );
}

// ── SECTION WRAPPER ───────────────────────────────────────────────────────────
function Section({ title, sub, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {sub && <p className={styles.sectionSub}>{sub}</p>}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}

// ── ROLE BADGE ────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const config = {
    superadmin: { label: "Super Admin", color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" },
    admin:      { label: "Admin",       color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
    verifier:   { label: "Verifier",    color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  };
  const c = config[role] || config.admin;
  return (
    <span className={styles.roleBadge} style={{ color: c.color, background: c.bg, borderColor: c.border }}>
      {c.label}
    </span>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const [user,         setUser]         = useState(null);
  const [loadingUser,  setLoadingUser]  = useState(true);

  // Profile state
  const [phone,        setPhone]        = useState("");

  // Password state
  const [passwords,    setPasswords]    = useState({ current: "", newPass: "", confirm: "" });
  const [showCurrent,  setShowCurrent]  = useState(false);
  const [showNew,      setShowNew]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [savingPwd,    setSavingPwd]    = useState(false);
  const [pwdSuccess,   setPwdSuccess]   = useState(false);
  const [pwdError,     setPwdError]     = useState("");
  const [editingPwd, setEditingPwd] = useState(false);

  // Admin users state (super admin only)
  const [adminUsers,   setAdminUsers]   = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser,      setNewUser]      = useState({
    firstname: "", lastname: "", email: "",
    phone_number: "", nin_hash: "", password: "", role: "admin",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError,  setCreateError]  = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState({});
  const [deactivating, setDeactivating] = useState({});

  const [stats, setStats] = useState({ schemes: 0, students: 0, applications: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const isSuperAdmin = user?.role === "superadmin";

  // ── LOAD CURRENT USER ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await getMe();
        if (cancelled) return;
        setUser(res.data);
        setPhone(res.data.phone_number || "");
      } catch {
        // Layout handles auth
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
  async function loadStats() {
    try {
      const [schemes, students, applications] = await Promise.all([
        getSchemes(),
        getStudents(),
        getApplications(),
      ]);
      setStats({
        schemes:      schemes.data?.count      ?? 0,
        students:     students.data?.count     ?? 0,
        applications: applications.data?.count ?? 0,
      });
    } catch {
      // Fail silently
    } finally {
      setLoadingStats(false);
    }
  }
  loadStats();
}, []);

  // ── LOAD ADMIN USERS (super admin only) ───────────────────────────────────
  useEffect(() => {
    if (!isSuperAdmin) return;
    loadAdminUsers();
  }, [isSuperAdmin]);

  async function loadAdminUsers() {
    setLoadingUsers(true);
    try {
    const res = await getAdminUsers();
    const data = res.data;
    setAdminUsers(Array.isArray(data) ? data : (data?.results ?? []));
    } catch {
      // Endpoint may not be ready yet — fail silently
    } finally {
      setLoadingUsers(false);
    }
  }

  // ── CHANGE PASSWORD ───────────────────────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    if (passwords.newPass.length < 8) { setPwdError("Password must be at least 8 characters."); return; }
    if (passwords.newPass !== passwords.confirm) { setPwdError("Passwords do not match."); return; }

    setSavingPwd(true);
    setPwdError("");
    setPwdSuccess(false);
    try {
      // NOTE: Wire to change password endpoint when backend adds it
      // await changePassword({ current_password: passwords.current, new_password: passwords.newPass });
      await new Promise((r) => setTimeout(r, 1000)); // placeholder
      setPwdSuccess(true);
      setPasswords({ current: "", newPass: "", confirm: "" });
    } catch (err) {
      setPwdError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to change password."
      );
    } finally {
      setSavingPwd(false);
    }
  }

  // ── CREATE ADMIN USER ─────────────────────────────────────────────────────
  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess(false);

    if (!newUser.firstname.trim() || !newUser.lastname.trim() ||
        !newUser.email.trim() || !newUser.phone_number.trim() ||
        !newUser.nin_hash.trim() || !newUser.password.trim()) {
      setCreateError("All fields are required.");
      return;
    }

    setCreatingUser(true);
    try {
      await createAdminUser(newUser);
      setCreateSuccess(true);
      setNewUser({ firstname: "", lastname: "", email: "", phone_number: "", nin_hash: "", password: "", role: "admin" });
      setShowCreateForm(false);
      loadAdminUsers();
    } catch (err) {
      setCreateError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to create user."
      );
    } finally {
      setCreatingUser(false);
    }
  }

  // ── UPDATE ROLE ───────────────────────────────────────────────────────────
async function handleRoleChange(id, newRole) {
  if (!confirm(`Change this user's role to ${newRole}?`)) return;
  
  setRoleUpdating((p) => ({ ...p, [id]: true }));
  try {
    await updateUserRole(id, { role: newRole });
    setAdminUsers((prev) => prev.map((u) =>
      u.id === id ? { ...u, role: newRole } : u
    ));
  } catch {
    // Fail silently for now
  } finally {
    setRoleUpdating((p) => ({ ...p, [id]: false }));
  }
}

  // ── DEACTIVATE & ACTIVATE USER ───────────────────────────────────────────────────────
async function handleReactivate(id) {
  if (!confirm("Reactivate this account?")) return;
  setDeactivating((p) => ({ ...p, [id]: true }));
  try {
    await reactivateUser(id);
    setAdminUsers((prev) => prev.map((u) =>
      u.id === id ? { ...u, is_active: true } : u
    ));
  } catch {
    // Fail silently
  } finally {
    setDeactivating((p) => ({ ...p, [id]: false }));
  }
}

  async function handleDeactivate(id) {
    if (!confirm("Are you sure you want to deactivate this account?")) return;
    setDeactivating((p) => ({ ...p, [id]: true }));
    try {
      await deactivateUser(id);
      setAdminUsers((prev) => prev.map((u) =>
        u.id === id ? { ...u, is_active: false } : u
      ));
    } catch {
      // Fail silently
    } finally {
      setDeactivating((p) => ({ ...p, [id]: false }));
    }
  }

  if (loadingUser) {
    return (
      <div className={styles.centerState}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>

      <div className={styles.pageHeader}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Settings size={20} color="#15803d" strokeWidth={1.8} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.sub}>Manage your account and portal configuration.</p>
        </div>
      </div>

      {/* SYSTEM STATUS */}
      <div className={styles.statusStrip}>
        {[
          { label: "Total Schemes",      value: stats.schemes,      color: "#15803d" },
          { label: "Total Students",     value: stats.students,     color: "#1d4ed8" },
          { label: "Total Applications", value: stats.applications, color: "#b45309" },
        ].map((s) => (
          <div key={s.label} className={styles.statusItem}>
            <span className={styles.statusValue} style={{ color: s.color }}>
              {loadingStats ? "—" : s.value}
            </span>
            <span className={styles.statusLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── SECTION 1: MY PROFILE ── */}
      <Section title="My Profile" sub="Update your contact information.">
        <div className={styles.profileCard}>
          <div className={styles.profileAvatar}>
            {(user?.firstname?.[0] || "").toUpperCase()}
            {(user?.lastname?.[0]  || "").toUpperCase()}
          </div>

          <div className={styles.profileInfo}>
            <p className={styles.profileName}>{user?.firstname} {user?.lastname}</p>
            <p className={styles.profileEmail}>{user?.email}</p>
            <p className={styles.profileLastLogin}>
              Last login: {user?.last_login
                ? new Date(user.last_login).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                : "—"
              }
            </p>
            <RoleBadge role={user?.role} />
          </div>
        </div>

        <div className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>
                <User size={12} strokeWidth={2} /> First Name
              </label>
              <input
                className={`${styles.formInput} ${styles.formInputDisabled}`}
                value={user?.firstname || ""}
                disabled
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>
                <User size={12} strokeWidth={2} /> Last Name
              </label>
              <input
                className={`${styles.formInput} ${styles.formInputDisabled}`}
                value={user?.lastname || ""}
                disabled
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>
                <Mail size={12} strokeWidth={2} /> Email Address
              </label>
              <input
                className={`${styles.formInput} ${styles.formInputDisabled}`}
                value={user?.email || ""}
                disabled
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>
                <Phone size={12} strokeWidth={2} /> Phone Number
              </label>
              <input
                className={`${styles.formInput} ${styles.formInputDisabled}`}
                value={phone}
                disabled
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ── SECTION 2: CHANGE PASSWORD ── */}
        <Section title="Password & Security" sub="Keep your account secure with a strong password.">
           {!editingPwd ? (
            <div className={styles.pwdEmptyState}>
              <div className={styles.pwdEmptyIcon}>
                <Lock size={20} strokeWidth={1.8} />
              </div>
              <div>
                <p className={styles.pwdEmptyTitle}>Password protected</p>
                <p className={styles.pwdEmptySub}>Your password is set. Click below to change it.</p>
              </div>
              <button className={styles.editBtn} onClick={() => setEditingPwd(true)}>
                <Lock size={13} strokeWidth={2} /> Change Password
              </button>
            </div>
          ) : (
          <>
            {pwdSuccess && (
              <div className={styles.successBanner}>
                <ShieldCheck size={14} strokeWidth={2} /> Password changed successfully.
              </div>
            )}
            {pwdError && (
              <div className={styles.errorBanner}>
                <AlertCircle size={14} strokeWidth={2} /> {pwdError}
              </div>
            )}

            <form className={styles.form} onSubmit={handleChangePassword}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>
                  <Lock size={12} strokeWidth={2} /> Current Password
                </label>
                <div className={styles.pwdWrap}>
                  <input
                    type={showCurrent ? "text" : "password"}
                    className={styles.formInput}
                    value={passwords.current}
                    onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                    placeholder="Enter current password"
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowCurrent((v) => !v)}>
                    {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>
                    <Lock size={12} strokeWidth={2} /> New Password
                  </label>
                  <div className={styles.pwdWrap}>
                    <input
                      type={showNew ? "text" : "password"}
                      className={styles.formInput}
                      value={passwords.newPass}
                      onChange={(e) => { setPasswords((p) => ({ ...p, newPass: e.target.value })); setPwdError(""); }}
                      placeholder="New password"
                    />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowNew((v) => !v)}>
                      {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <PasswordStrength password={passwords.newPass} />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>
                    <Lock size={12} strokeWidth={2} /> Confirm New Password
                  </label>
                  <div className={styles.pwdWrap}>
                    <input
                      type={showConfirm ? "text" : "password"}
                      className={styles.formInput}
                      value={passwords.confirm}
                      onChange={(e) => { setPasswords((p) => ({ ...p, confirm: e.target.value })); setPwdError(""); }}
                      placeholder="Confirm password"
                    />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm((v) => !v)}>
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {passwords.confirm && passwords.newPass === passwords.confirm && (
                    <span className={styles.matchHint}>
                      <Check size={12} strokeWidth={2.5} /> Passwords match
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.formFoot}>
                <button type="button" className={styles.cancelBtn} onClick={() => { setEditingPwd(false); setPasswords({ current: "", newPass: "", confirm: "" }); setPwdError(""); }}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={savingPwd}>
                  {savingPwd
                    ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Updating...</>
                    : <>Update Password</>
                  }
                </button>
              </div>
            </form>
          </>
        )}
      </Section>
      {/* ── SECTION 3: ADMIN USERS (super admin only) ── */}
      {isSuperAdmin && (
        <Section
          title="Admin Users"
          sub="Manage all administrators and verifiers on the portal."
        >
          {/* Create success banner */}
          {createSuccess && (
            <div className={styles.successBanner}>
              <ShieldCheck size={14} strokeWidth={2} /> New admin user created successfully.
            </div>
          )}

          {/* Header row */}
          <div className={styles.usersHeader}>
            <span className={styles.usersCount}>
              {loadingUsers ? "Loading..." : `${adminUsers.length} user${adminUsers.length !== 1 ? "s" : ""}`}
            </span>
            <div className={styles.usersActions}>
              <button
                className={styles.refreshUsersBtn}
                onClick={loadAdminUsers}
                disabled={loadingUsers}
              >
                <RefreshCw size={13} strokeWidth={2} className={loadingUsers ? styles.spin : ""} />
              </button>
              <button
                className={styles.createUserBtn}
                onClick={() => { setShowCreateForm((v) => !v); setCreateError(""); setCreateSuccess(false); }}
              >
                {showCreateForm ? <X size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
                {showCreateForm ? "Cancel" : "New User"}
              </button>
            </div>
          </div>

          {/* Create user form */}
          {showCreateForm && (
            <div className={styles.createForm}>
              <h3 className={styles.createFormTitle}>Create Admin User</h3>
              {createError && (
                <div className={styles.errorBanner}>
                  <AlertCircle size={14} strokeWidth={2} /> {createError}
                </div>
              )}
              <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                <div className={styles.formRow}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>First Name</label>
                    <input className={styles.formInput} value={newUser.firstname}
                      onChange={(e) => setNewUser((u) => ({ ...u, firstname: e.target.value }))}
                      placeholder="First name" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Last Name</label>
                    <input className={styles.formInput} value={newUser.lastname}
                      onChange={(e) => setNewUser((u) => ({ ...u, lastname: e.target.value }))}
                      placeholder="Last name" />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Email Address</label>
                    <input type="email" className={styles.formInput} value={newUser.email}
                      onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                      placeholder="admin@rmhcdt.org" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Phone Number</label>
                    <input className={styles.formInput} value={newUser.phone_number}
                      onChange={(e) => setNewUser((u) => ({ ...u, phone_number: e.target.value }))}
                      placeholder="08000000000" />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>NIN</label>
                    <input className={styles.formInput} value={newUser.nin_hash}
                      onChange={(e) => setNewUser((u) => ({ ...u, nin_hash: e.target.value }))}
                      placeholder="11-digit NIN" maxLength={11} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Role</label>
                    <select className={styles.formInput} value={newUser.role}
                      onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}>
                      <option value="admin">Admin</option>
                      <option value="verifier">Verifier</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Temporary Password</label>
                  <input type="password" className={styles.formInput} value={newUser.password}
                    onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                    placeholder="Minimum 8 characters" />
                  <span className={styles.formHint}>User should change this on first login.</span>
                </div>
                <div className={styles.formFoot}>
                  <button type="submit" className={styles.saveBtn} disabled={creatingUser}>
                    {creatingUser
                      ? <><Loader2 size={14} strokeWidth={2} className={styles.spin} /> Creating...</>
                      : <><Plus size={14} strokeWidth={2} /> Create User</>
                    }
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Admin users table */}
          {loadingUsers ? (
            <div className={styles.usersLoading}>
              <div className={styles.spinner} />
            </div>
          ) : adminUsers.length === 0 ? (
            <div className={styles.usersEmpty}>
              <Users size={24} color="#cbd5e1" strokeWidth={1.5} />
              <p>No admin users found.</p>
            </div>
          ) : (
            <div className={styles.usersTable}>
              {/* Header */}
              <div className={styles.usersTableHeader}>
                <span>User</span>
                <span>Role</span>
                <span>Status</span>
                <span>Actions</span>
              </div>

              {adminUsers.map((u) => {
                const initials =
                  (u.firstname?.[0] || "").toUpperCase() +
                  (u.lastname?.[0]  || "").toUpperCase();
                const isMe = u.id === user?.id;

                return (
                  <div key={u.id} className={`${styles.userRow} ${!u.is_active ? styles.userRowInactive : ""}`}>

                    {/* User info */}
                    <div className={styles.userInfo}>
                      <div className={styles.userAvatar}>{initials}</div>
                      <div>
                        <p className={styles.userName}>
                          {u.firstname} {u.lastname}
                          {isMe && <span className={styles.youBadge}>You</span>}
                        </p>
                        <p className={styles.userEmail}>{u.email}</p>
                      </div>
                    </div>

                    {/* Role */}
                    <div className={styles.userRole}>
                      {isMe ? (
                        <RoleBadge role={u.role} />
                      ) : (
                        <select
                          className={styles.roleSelect}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={roleUpdating[u.id] || !u.is_active}
                        >
                          <option value="admin">Admin</option>
                          <option value="verifier">Verifier</option>
                        </select>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      {u.is_active ? (
                        <span className={styles.activeChip}>Active</span>
                      ) : (
                        <span className={styles.inactiveChip}>Inactive</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className={styles.userActions}>
                      {!isMe && u.is_active && (
                        <button
                          className={styles.deactivateBtn}
                          onClick={() => handleDeactivate(u.id)}
                          disabled={deactivating[u.id]}
                        >
                          {deactivating[u.id]
                            ? <Loader2 size={12} strokeWidth={2} className={styles.spin} />
                            : <UserX size={12} strokeWidth={2} />
                          }
                          Deactivate
                        </button>
                      )}
                      {isMe && (
                        <span className={styles.selfNote}>Current session</span>
                      )}
                      {!isMe && !u.is_active && (
                          <button
                            className={styles.reactivateBtn}
                            onClick={() => handleReactivate(u.id)}
                            disabled={deactivating[u.id]}
                          >
                            {deactivating[u.id]
                              ? <Loader2 size={12} strokeWidth={2} className={styles.spin} />
                              : <UserCheck size={12} strokeWidth={2} />
                            }
                            Reactivate
                          </button>
                        )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

    </div>
  );
}