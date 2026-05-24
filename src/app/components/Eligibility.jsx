import { CheckCircle2, AlertCircle } from "lucide-react";
import styles from "./Eligibility.module.css";

const requirements = [
  {
    title: "Mbo Community Member",
    desc: "You must be a member of the Royal Mbo host community or qualify under the Trust's host community definition as established in the Trust's governing documents.",
  },
  {
    title: "Meet Programme Criteria",
    desc: "You must meet the specific eligibility criteria stated in the chosen programme's announcement at the time of application.",
  },
  {
    title: "Complete Application",
    desc: "You must submit a complete application including a valid Self-Declaration of any support received in the past 12 months.",
  },
  {
    title: "No Active Disqualification",
    desc: "You must not be under any active disqualification from the Trust at the time of application.",
  },
];

const rules = [
  {
    title: "One NIN, One Account",
    desc: "Your National Identification Number can only be registered once. There is no way to create multiple accounts.",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    title: "Self-Declaration is Mandatory",
    desc: "You must disclose all support received from any trust, NGO, or government programme in the past 12 months. Lying triggers automatic disqualification.",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  {
    title: "One Per Category Per Cycle",
    desc: "You cannot receive two scholarships in the same annual cycle — but you can receive a scholarship and a grant together.",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  {
    title: "Annual Cycle Resets",
    desc: "Exclusions reset every 1st April. If you were a beneficiary last cycle, you can apply again in the new cycle.",
    color: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
];

export default function Eligibility() {
  return (
    <section className={styles.section} id="eligibility">
      <div className={styles.container}>

        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.label}>
            <span className={styles.labelDot} />
            Who Can Apply
          </div>
          <h2 className={styles.heading}>
            Eligibility &
            <span className={styles.headingAccent}> Key Rules</span>
          </h2>
          <p className={styles.subtext}>
            Make sure you meet all requirements before applying.
            Read the rules carefully to avoid disqualification.
          </p>
        </div>

        {/* TWO COLUMNS */}
        <div className={styles.grid}>

          {/* LEFT — REQUIREMENTS */}
          <div className={styles.col}>
            <div className={styles.colHeader}>
              <CheckCircle2 size={20} color="#15803d" strokeWidth={2} />
              <span className={styles.colTitle}>Requirements</span>
            </div>
            <div className={styles.requirementList}>
              {requirements.map((r, i) => (
                <div key={i} className={styles.requirementItem}>
                  <div className={styles.checkBox}>
                    <CheckCircle2 size={18} color="#15803d" strokeWidth={2} />
                  </div>
                  <div className={styles.requirementContent}>
                    <span className={styles.requirementTitle}>{r.title}</span>
                    <span className={styles.requirementDesc}>{r.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — RULES */}
          <div className={styles.col}>
            <div className={styles.colHeader}>
              <AlertCircle size={20} color="#b45309" strokeWidth={2} />
              <span className={styles.colTitle}>Important Rules</span>
            </div>
            <div className={styles.rulesList}>
              {rules.map((r, i) => (
                <div
                  key={i}
                  className={styles.ruleCard}
                  style={{
                    background: r.bg,
                    borderColor: r.border,
                  }}
                >
                  <div
                    className={styles.ruleNum}
                    style={{ color: r.color }}
                  >
                    0{i + 1}
                  </div>
                  <div className={styles.ruleContent}>
                    <span
                      className={styles.ruleTitle}
                      style={{ color: r.color }}
                    >
                      {r.title}
                    </span>
                    <span className={styles.ruleDesc}>{r.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}