import { GraduationCap, Briefcase, Wrench, Banknote, ArrowRight } from "lucide-react";
import styles from "./Programmes.module.css";

const programmes = [
  {
    icon: GraduationCap,
    title: "Scholarship",
    category: "Education",
    desc: "Financial support for secondary, tertiary, vocational, and professional studies.",
    items: ["Tuition assistance", "Examination fees", "Educational materials", "Professional studies"],
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    light: "#dcfce7",
  },
  {
    icon: Briefcase,
    title: "Empowerment",
    category: "Business",
    desc: "Direct support to individuals or small groups to establish or expand income-generating activities.",
    items: ["Starter packs", "Equipment support", "Working capital", "Cooperative formation"],
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    light: "#fef3c7",
  },
  {
    icon: Wrench,
    title: "Training",
    category: "Skills",
    desc: "Structured skill development programmes including vocational, digital, and capacity-building initiatives.",
    items: ["Vocational training", "Digital skills", "Agricultural extension", "Health auxiliary training"],
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    light: "#dbeafe",
  },
  {
    icon: Banknote,
    title: "Grant",
    category: "Funding",
    desc: "Financial awards for business start-up capital, project funding, and targeted financial assistance.",
    items: ["Business start-up capital", "Project funding", "Research support", "Targeted assistance"],
    color: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
    light: "#f3e8ff",
  },
];

export default function Programmes() {
  return (
    <section className={styles.section} id="programmes">
      <div className={styles.container}>

        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.label}>
            <span className={styles.labelDot} />
            What We Offer
          </div>
          <h2 className={styles.heading}>
            Four Paths to
            <span className={styles.headingAccent}> Support</span>
          </h2>
          <p className={styles.subtext}>
            Each programme category serves a distinct development purpose.
            You may receive one per category per annual cycle.
          </p>
        </div>

        {/* CARDS */}
        <div className={styles.grid}>
          {programmes.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className={styles.card}
                style={{ borderColor: p.border }}
              >
                {/* CARD TOP */}
                <div
                  className={styles.cardTop}
                  style={{ background: p.bg }}
                >
                  <div
                    className={styles.iconBox}
                    style={{ background: p.color }}
                  >
                    <Icon size={22} color="#ffffff" strokeWidth={2} />
                  </div>
                  <div className={styles.categoryBadge} style={{ background: p.light, color: p.color, borderColor: p.border }}>
                    {p.category}
                  </div>
                </div>

                {/* CARD BODY */}
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{p.title}</h3>
                  <p className={styles.cardDesc}>{p.desc}</p>

                  {/* ITEMS */}
                  <ul className={styles.itemList}>
                    {p.items.map((item, j) => (
                      <li key={j} className={styles.item}>
                        <span
                          className={styles.itemDot}
                          style={{ background: p.color }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>

                  {/* BUTTON */}
                  <a
                    href="/register"
                    className={styles.cardBtn}
                    style={{
                      color: p.color,
                      borderColor: p.border,
                      background: p.bg,
                    }}
                  >
                    Apply for {p.title}
                    <ArrowRight size={14} strokeWidth={2} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}