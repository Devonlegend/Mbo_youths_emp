"use client";
import { useState } from "react";
import {
  ShieldCheck, BookOpen, ChevronDown, ChevronUp,
  GraduationCap, Briefcase, Wrench, Banknote,
  LayoutGrid, AlertTriangle, Ban, RefreshCw,
  Calendar, FileText, Users, Lock, Scale,
} from "lucide-react";
import styles from "./page.module.css";

/* ─────────────────────────────────────────
   DATA
───────────────────────────────────────── */
const summaryCards = [
  {
    icon: LayoutGrid,
    iconClass: "si_green",
    label: "Programme categories",
    value: "4",
    desc: "Scholarship, Empowerment, Training, Grant",
  },
  {
    icon: RefreshCw,
    iconClass: "si_blue",
    label: "Per-cycle rule",
    value: "1×",
    desc: "One award per category per cycle allowed",
  },
  {
    icon: Calendar,
    iconClass: "si_amber",
    label: "Cycle period",
    value: "Annual",
    desc: "1st April to 31st March each year",
  },
  {
    icon: Ban,
    iconClass: "si_red",
    label: "False declaration",
    value: "NIN lock",
    desc: "Permanent ban on 2nd offence",
  },
];

const categories = [
  {
    icon: GraduationCap,
    iconClass: "si_green",
    name: "Scholarship",
    desc: "Financial support for formal education — tuition, exam fees, educational materials, and related support for secondary, tertiary, vocational, or professional studies.",
  },
  {
    icon: Briefcase,
    iconClass: "si_blue",
    name: "Empowerment",
    desc: "Direct support to establish or expand income-generating activities — starter packs, equipment, working capital, and cooperative formation support.",
  },
  {
    icon: Wrench,
    iconClass: "si_amber",
    name: "Training",
    desc: "Structured skill development — vocational training, digital skills, agricultural extension, health auxiliary training, internships, and capacity-building.",
  },
  {
    icon: Banknote,
    iconClass: "si_red",
    name: "Grant",
    desc: "Financial awards for business start-up capital, project funding, research support, or targeted financial assistance not covered by Scholarship or Empowerment.",
  },
];

const policySections = [
  {
    num: "1",
    title: "Purpose",
    icon: FileText,
    content: (
      <>
        <p>This policy establishes a transparent, fair, and documented process for selecting beneficiaries of scholarship, empowerment, training, and grant programmes administered by Royal Mbo Host Community Development Trust, operating under the Petroleum Industry Act, 2021.</p>
        <p>The policy is designed to:</p>
        <ul>
          <li>Ensure opportunities reach the widest possible range of eligible community members</li>
          <li>Prevent duplication of benefits to the same individuals within a single funding cycle</li>
          <li>Create a documented record of selections defensible under audit or community review</li>
          <li>Protect the credibility of the Trust and the integrity of its development mandate</li>
        </ul>
      </>
    ),
  },
  {
    num: "2",
    title: "Eligibility and selection rules",
    icon: ShieldCheck,
    content: (
      <>
        <p><strong>General eligibility.</strong> To be eligible, an applicant must be a member of the Royal Mbo host community, meet the specific eligibility criteria stated in the programme announcement, submit a complete application including a valid self-declaration, and not be under any active disqualification.</p>
        <div className={styles.ruleBox}>
          <strong>One-per-category-per-cycle rule.</strong> A person selected as a beneficiary in any programme category during the current cycle shall not be eligible for another award in the same category during the same cycle. They may apply across different categories — for example, receiving Training and then a Grant is permitted.
        </div>
        <p><strong>Parallel applications.</strong> An applicant may submit applications to more than one open programme while previous applications are still pending. If selected in two programmes within the same category, the applicant must choose one. The unchosen slot reopens to the next-best qualified candidate.</p>
        <p><strong>Cycle reset.</strong> All per-cycle exclusions reset on 1st April annually. Prior-cycle beneficiaries become fully eligible to apply again in the new cycle.</p>
      </>
    ),
  },
  {
    num: "3",
    title: "Self-declaration of prior support",
    icon: BookOpen,
    content: (
      <>
        <p>Every applicant must complete a mandatory self-declaration disclosing all support received from any of the following within the past one (1) year:</p>
        <ul>
          <li>Royal Mbo Host Community Development Trust</li>
          <li>Any other Host Community Development Trust</li>
          <li>Any government agency, ministry, or programme (federal, state, or local)</li>
          <li>Any non-governmental organisation, foundation, or similar body</li>
          <li>Any private or corporate social investment programme</li>
        </ul>
        <div className={styles.ruleBox}>
          <strong>Attestation required.</strong> Every applicant must attest: "I confirm that the information provided in this application, including the declaration of prior support, is true, accurate, and complete to the best of my knowledge. I understand that providing false or misleading information will result in rejection and may result in disqualification." No application shall be processed without this attestation.
        </div>
      </>
    ),
  },
  {
    num: "4",
    title: "Verification process",
    icon: ShieldCheck,
    content: (
      <>
        <p>The Trust maintains a <strong>Beneficiary Register</strong> recording all persons selected as beneficiaries. At application submission, each application is automatically verified against this register.</p>
        <p>An application is flagged for Management Committee review if:</p>
        <ul>
          <li>The applicant's NIN (or name + date of birth + LGA) matches a beneficiary record in the same category and cycle</li>
          <li>The applicant has declared prior support in their self-declaration</li>
          <li>Both of the above conditions are met</li>
        </ul>
        <p>Flagged applications are reviewed before any selection decision is finalised. The reviewing officer examines the basis of the flag, determines ongoing eligibility, documents the decision, and takes one of three actions: approve to proceed, reject on grounds of duplication, or refer to the full Management Committee.</p>
        <p>All flag reviews and decisions are retained for not less than <strong>five (5) years</strong> from the close of the relevant cycle.</p>
      </>
    ),
  },
  {
    num: "5",
    title: "False declarations and disqualification",
    icon: AlertTriangle,
    content: (
      <>
        <p>A false declaration occurs when an applicant denies prior support but is found through verification to have received support that should have been declared, or provides materially inaccurate information about prior support.</p>
        <p><strong>First offence:</strong> Application rejected immediately. Disqualified for the remainder of the current cycle and the entirety of the following cycle. Offence recorded in the Disqualification Register.</p>
        <p><strong>Second offence:</strong> Application rejected immediately. Permanent disqualification from all future programmes. Disqualification recorded against NIN — it follows the person across any account they create.</p>
        <div className={styles.ruleBox}>
          <strong>Right to be heard.</strong> Before any disqualification takes effect, the applicant is notified in writing and given 14 days to provide a written response. The Management Committee considers any response before confirming disqualification.
        </div>
      </>
    ),
  },
  {
    num: "6",
    title: "Data protection and privacy",
    icon: Lock,
    content: (
      <>
        <p>The Trust collects and processes personal data of applicants and beneficiaries under the <strong>Nigeria Data Protection Act (NDPA)</strong> for the legitimate purposes of administering programmes, verifying eligibility, preventing duplication, and maintaining accountability records as required by the PIA.</p>
        <p>Access to the Beneficiary Register and Disqualification Register is limited to members of the Management Committee, designated officers, Board of Trustees members in the exercise of oversight, and lawfully authorised auditors or regulators including NUPRC. No personal data is disclosed to any other party without written consent of the data subject or as required by law.</p>
        <p>Records are retained for a minimum of <strong>five (5) years</strong> from the close of the relevant cycle.</p>
      </>
    ),
  },
  {
    num: "7",
    title: "Roles and responsibilities",
    icon: Users,
    content: (
      <>
        <p><strong>Management Committee</strong> — approves all programme announcements, oversees the Beneficiary Register and verification process, reviews flagged applications, considers disqualification responses, and reports annually to the Board of Trustees.</p>
        <p><strong>Designated Officer</strong> — administers the day-to-day operation of this policy including maintenance of the Beneficiary Register, initial review of flagged applications, and communication with applicants. Refers all final rejection or disqualification decisions to the Committee for confirmation.</p>
        <p><strong>Board of Trustees</strong> — approves this policy and any amendments, receives annual reports from the Management Committee, and provides oversight of implementation in line with the Trust's fiduciary obligations under the PIA.</p>
      </>
    ),
  },
  {
    num: "8",
    title: "Review and amendment",
    icon: Scale,
    content: (
      <>
        <p>This policy is reviewed annually by the Management Committee at the close of each cycle. The review considers the operation of the policy during the preceding cycle, issues or gaps identified, and any recommendations for amendment.</p>
        <p>Amendments require a formal proposal to the Management Committee, approval by majority resolution, and confirmation by the Board of Trustees.</p>
        <p>In exceptional circumstances, the Management Committee may adopt a provisional emergency amendment with immediate effect, subject to ratification by the Board of Trustees at its next meeting.</p>
        <p>This policy took effect from <strong>1st April 2026</strong>, being the start of the current cycle, and applies to all programmes announced or selections made from that date onward.</p>
      </>
    ),
  },
];

/* ─────────────────────────────────────────
   ACCORDION ITEM
───────────────────────────────────────── */
function PolicySection({ num, title, icon: Icon, content }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${styles.policyGroup} ${open ? styles.policyGroupOpen : ""}`}>
      <button className={styles.policyGroupBtn} onClick={() => setOpen((v) => !v)} type="button">
        <div className={styles.policyGroupLeft}>
          <div className={styles.policyGroupNum}>{num}</div>
          <span className={styles.policyGroupTitle}>{title}</span>
        </div>
        {open
          ? <ChevronUp size={15} strokeWidth={2} className={styles.policyChevron} />
          : <ChevronDown size={15} strokeWidth={2} className={styles.policyChevron} />
        }
      </button>
      {open && (
        <div className={styles.policyGroupBody}>
          <div className={styles.policyText}>
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   PAGE
───────────────────────────────────────── */
export default function PolicyPage() {
  return (
    <div className={styles.page}>

      {/* PAGE HEADER */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderIcon}>
          <ShieldCheck size={22} strokeWidth={1.8} color="#15803d" />
        </div>
        <h1 className={styles.pageTitle}>Beneficiary Selection Policy</h1>
        <p className={styles.pageTagline}>Royal Mbo Host Community Development Trust</p>
        <p className={styles.pageSub}>Effective 1st April 2026 · Petroleum Industry Act, 2021</p>
      </div>

      <div className={styles.body}>

        {/* SUMMARY CARDS */}
        <div className={styles.summaryGrid}>
          {summaryCards.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={styles.summaryCard}>
                <div className={`${styles.summaryCardIcon} ${styles[s.iconClass]}`}>
                  <Icon size={16} strokeWidth={1.8} />
                </div>
                <span className={styles.summaryCardLabel}>{s.label}</span>
                <div className={styles.summaryCardValue}>{s.value}</div>
                <p className={styles.summaryCardDesc}>{s.desc}</p>
              </div>
            );
          })}
        </div>

        {/* CATEGORIES */}
        <div>
          <div className={styles.sectionHead}>
            <div className={styles.sectionIcon} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <LayoutGrid size={16} strokeWidth={1.9} color="#15803d" />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Programme categories</h2>
              <p className={styles.sectionSub}>Every programme is classified under exactly one of these four categories.</p>
            </div>
          </div>
          <div className={styles.catGrid}>
            {categories.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.name} className={styles.catCard}>
                  <div className={styles.catCardTop}>
                    <div className={`${styles.catCardIcon} ${styles[c.iconClass]}`}>
                      <Icon size={16} strokeWidth={1.8} />
                    </div>
                    <span className={styles.catCardName}>{c.name}</span>
                  </div>
                  <p className={styles.catCardDesc}>{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* DIVIDER */}
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>Full policy text</span>
          <span className={styles.dividerLine} />
        </div>

        {/* POLICY SECTIONS */}
        <div>
          <div className={styles.sectionHead}>
            <div className={styles.sectionIcon} style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <BookOpen size={16} strokeWidth={1.9} color="#64748b" />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Policy sections</h2>
              <p className={styles.sectionSub}>Click any section to read the full text. Prepared by the Management Committee, 13th May 2026.</p>
            </div>
          </div>
          <div className={styles.policyGroups}>
            {policySections.map((s) => (
              <PolicySection key={s.num} {...s} />
            ))}
          </div>
        </div>

        {/* BOTTOM BADGE */}
        <div className={styles.bottomBadge}>
          <ShieldCheck size={13} color="#15803d" strokeWidth={2} />
          <span>Secured under the Petroleum Industry Act, 2021 · Adopted 13th May 2026</span>
        </div>

      </div>
    </div>
  );
}