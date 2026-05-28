"use client";
import { useState } from "react";
import {
  HelpCircle, MessageSquare, ChevronDown, ChevronUp,
  MapPin, Mail, Phone, Send, CheckCircle,
  FileText, GraduationCap, Wallet, ShieldCheck,
  Clock, Search, BookOpen, AlertCircle, Filter, X,
} from "lucide-react";
import styles from "./page.module.css";

/* ─────────────────────────────────────────
   DATA
───────────────────────────────────────── */
const faqs = [
  {
    category: "Applications",
    icon: FileText,
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    items: [
      { q: "How do I apply for a programme?", a: "Navigate to the Programmes section from your dashboard, browse available opportunities, and click 'Apply Now' on any listing. Ensure your profile and documents are complete before applying." },
      { q: "Can I apply for more than one programme at a time?", a: "Yes. You may submit applications to multiple programmes simultaneously. However, some programmes have exclusivity clauses — read each programme's eligibility criteria carefully before applying." },
      { q: "How long does the review process take?", a: "Application reviews typically take 10–21 working days from the submission deadline. You will receive a status update via email and in your Notifications dashboard." },
      { q: "Can I edit my application after submission?", a: "Applications cannot be edited once submitted. If you notice an error, contact the Trust's support team as soon as possible before the review window closes." },
    ],
  },
  {
    category: "Eligibility",
    icon: ShieldCheck,
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    items: [
      { q: "Who is eligible to register on the portal?", a: "The portal is open to youth from Mbo LGA, Akwa Ibom State, aged 18 and above, with a valid NIN. You must be a registered indigene of the host community under the Petroleum Industry Act, 2021." },
      { q: "Is my NIN verified against NIMC records?", a: "Yes. Your NIN is cross-referenced with NIMC during registration. Ensure the details you provide match your NIMC profile exactly to avoid verification failures." },
      { q: "What if I am above the youth age bracket for a specific programme?", a: "Age requirements vary by programme. Check each programme's eligibility criteria in the Programmes section. Some funding and livelihood programmes have broader age brackets." },
    ],
  },
  {
    category: "Scholarships & Funding",
    icon: GraduationCap,
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    items: [
      { q: "How are scholarship recipients selected?", a: "Selection is merit-based, supported by community verification and committee review. Shortlisted candidates are notified and may be invited for an interview or document verification session." },
      { q: "When are scholarship disbursements made?", a: "Disbursements are processed at the start of each academic semester, subject to confirmation of enrollment from your institution. Ensure your bank details in your profile are accurate." },
      { q: "Can I apply for both a scholarship and a grant simultaneously?", a: "Yes, as long as you meet the eligibility criteria for both. The Trust evaluates each application independently. Receiving one does not disqualify you from the other." },
    ],
  },
  {
    category: "Documents & Profile",
    icon: Wallet,
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    items: [
      { q: "What documents are required for registration?", a: "You will need a clear passport photograph and a Certificate of Origin from Mbo LGA. These are uploaded during registration and used for identity and community verification." },
      { q: "How do I update my profile or documents?", a: "Visit the My Profile section in your dashboard to update personal information. For document replacements, go to My Documents and upload the revised file. Some changes may require re-verification." },
      { q: "Is my personal data secure?", a: "Yes. All data on this portal is protected under the Nigeria Data Protection Act (NDPA) and the Trust's internal data governance policy. Your NIN and biometrics are never shared with third parties." },
    ],
  },
];

const contactInfo = [
  { icon: MapPin,  label: "Address",      value: "RMHCDT, Mbo LGA, Akwa Ibom State",       color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  { icon: Mail,    label: "Email",        value: "info@rmhcdt.org",                          color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { icon: Phone,   label: "Phone",        value: "+234 070 1234 5678",                       color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  { icon: Clock,   label: "Office Hours", value: "Mon – Fri, 8:00 AM – 5:00 PM WAT",        color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
];

/* ─────────────────────────────────────────
   FAQ ACCORDION ITEM
───────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${styles.faqItem} ${open ? styles.faqItemOpen : ""}`}>
      <button className={styles.faqQ} onClick={() => setOpen((v) => !v)} type="button">
        <span>{q}</span>
        {open
          ? <ChevronUp size={15} strokeWidth={2} className={styles.faqChevron} />
          : <ChevronDown size={15} strokeWidth={2} className={styles.faqChevron} />
        }
      </button>
      {open && <p className={styles.faqA}>{a}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────
   PAGE
───────────────────────────────────────── */
export default function HelpPage() {
  const [search, setSearch]               = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [filterOpen, setFilterOpen]       = useState(false);
  const [form, setForm]                   = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted]         = useState(false);
  const [sending, setSending]             = useState(false);

  const categories = ["All", ...faqs.map((f) => f.category)];

  const filtered = faqs
    .filter((f) => activeCategory === "All" || f.category === activeCategory)
    .map((f) => ({
      ...f,
      items: f.items.filter(
        (item) =>
          !search ||
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          item.a.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((f) => f.items.length > 0);

  const totalResults = filtered.reduce((acc, f) => acc + f.items.length, 0);

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setSubmitted(true);
  }

  return (
    <div className={styles.page}>

      {/* ── PAGE HEADER ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderIcon}>
          <HelpCircle size={22} strokeWidth={1.8} color="#15803d" />
        </div>
        <h1 className={styles.pageTitle}>Help &amp; Support</h1>
        <p className={styles.pageTagline}>How can we help you?</p>
        <p className={styles.pageSub}>
          Find answers to common questions or send a message to our support team.
        </p>
      </div>

      <div className={styles.body}>

        {/* ── FAQ SECTION ── */}
        <div className={styles.faqSection}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionIcon} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <BookOpen size={16} strokeWidth={1.9} color="#15803d" />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
              <p className={styles.sectionSub}>Browse by category or search for a specific topic.</p>
            </div>
          </div>

          {/* ── SEARCH + FILTER ROW ── */}
          <div className={styles.searchRow}>
            {/* Search */}
            <div className={styles.searchWrap}>
              <Search size={14} strokeWidth={2} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Search questions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className={styles.searchClear} type="button" onClick={() => setSearch("")}>
                  <X size={13} strokeWidth={2.2} />
                </button>
              )}
            </div>

            {/* Filter button */}
            <div className={styles.filterWrap}>
              <button
                type="button"
                className={`${styles.filterBtn} ${filterOpen || activeCategory !== "All" ? styles.filterBtnActive : ""}`}
                onClick={() => setFilterOpen((v) => !v)}
              >
                <Filter size={14} strokeWidth={2} />
                {activeCategory !== "All" ? activeCategory : "Filter"}
                {activeCategory !== "All" && (
                  <span
                    className={styles.filterClearDot}
                    onClick={(e) => { e.stopPropagation(); setActiveCategory("All"); setFilterOpen(false); }}
                  >
                    <X size={11} strokeWidth={2.5} />
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {filterOpen && (
                <div className={styles.filterDropdown}>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`${styles.filterOption} ${activeCategory === cat ? styles.filterOptionActive : ""}`}
                      onClick={() => { setActiveCategory(cat); setFilterOpen(false); }}
                    >
                      {cat}
                      {activeCategory === cat && <ShieldCheck size={12} strokeWidth={2} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* result count when searching */}
          {search && (
            <p className={styles.resultCount}>
              {totalResults} result{totalResults !== 1 ? "s" : ""} for <strong>"{search}"</strong>
            </p>
          )}

          {/* FAQ GROUPS */}
          {filtered.length === 0 ? (
            <div className={styles.noResults}>
              <AlertCircle size={22} color="#cbd5e1" strokeWidth={1.5} />
              <p>No results for <strong>"{search}"</strong>. Try a different keyword or browse all categories.</p>
            </div>
          ) : (
            <div className={styles.faqGroups}>
              {filtered.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.category} className={styles.faqGroup}>
                    <div className={styles.faqGroupHead}>
                      <div className={styles.faqGroupIcon} style={{ background: group.bg, border: `1px solid ${group.border}` }}>
                        <Icon size={14} strokeWidth={2} color={group.color} />
                      </div>
                      <span className={styles.faqGroupLabel} style={{ color: group.color }}>{group.category}</span>
                    </div>
                    <div className={styles.faqList}>
                      {group.items.map((item, i) => (
                        <FaqItem key={i} q={item.q} a={item.a} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── DIVIDER ── */}
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>Still need help?</span>
          <span className={styles.dividerLine} />
        </div>

        {/* ── CONTACT SECTION ── */}
        <div className={styles.contactSection}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionIcon} style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
              <MessageSquare size={16} strokeWidth={1.9} color="#1d4ed8" />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Contact Support</h2>
              <p className={styles.sectionSub}>Send a message and the Trust's officer will respond within 2 working days.</p>
            </div>
          </div>

          <div className={styles.contactGrid}>
            {/* LEFT — INFO CARDS */}
            <div className={styles.contactLeft}>
              {contactInfo.map((c, i) => {
                const Icon = c.icon;
                return (
                  <div key={i} className={styles.infoCard} style={{ background: c.bg, borderColor: c.border }}>
                    <div className={styles.infoIconBox} style={{ background: c.color }}>
                      <Icon size={16} color="#ffffff" strokeWidth={2} />
                    </div>
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>{c.label}</span>
                      <span className={styles.infoValue}>{c.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RIGHT — FORM */}
            <div className={styles.contactRight}>
              {submitted ? (
                <div className={styles.successBox}>
                  <div className={styles.successIconWrap}>
                    <CheckCircle size={36} color="#15803d" strokeWidth={1.8} />
                  </div>
                  <h3 className={styles.successTitle}>Message Sent</h3>
                  <p className={styles.successDesc}>Thank you for reaching out. The Trust's support officer will respond within 2 working days.</p>
                  <button type="button" className={styles.successReset}
                    onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}>
                    Send another message
                  </button>
                </div>
              ) : (
                <form className={styles.form} onSubmit={handleSubmit}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Full Name</label>
                      <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Your full name" className={styles.formInput} required />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Email Address</label>
                      <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="your@email.com" className={styles.formInput} required />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Subject</label>
                    <input type="text" name="subject" value={form.subject} onChange={handleChange} placeholder="e.g. Application issue, Document query..." className={styles.formInput} required />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Message</label>
                    <textarea name="message" value={form.message} onChange={handleChange} placeholder="Describe your issue or question in detail..." className={styles.formTextarea} rows={5} required />
                  </div>
                  <button type="submit" className={styles.submitBtn} disabled={sending}>
                    {sending
                      ? <><span className={styles.spinner} /> Sending...</>
                      : <><Send size={14} strokeWidth={2} /> Send Message</>
                    }
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* ── BOTTOM BADGE ── */}
        <div className={styles.bottomBadge}>
          <ShieldCheck size={13} color="#15803d" strokeWidth={2} />
          <span>Secured under the Petroleum Industry Act, 2021</span>
        </div>

      </div>
    </div>
  );
}