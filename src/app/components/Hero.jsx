import Link from "next/link";
import { GraduationCap, Briefcase, Wrench, Banknote, ArrowRight, ShieldCheck } from "lucide-react";
import styles from "./Hero.module.css";

const programmes = [
  {
    icon: GraduationCap,
    title: "Scholarship",
    desc: "Tuition, exam fees & educational materials",
    accent: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    icon: Briefcase,
    title: "Empowerment",
    desc: "Starter packs, equipment & working capital",
    accent: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  {
    icon: Wrench,
    title: "Training",
    desc: "Vocational, digital & capacity building",
    accent: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  {
    icon: Banknote,
    title: "Grant",
    desc: "Business start-up & project funding",
    accent: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
];

const stats = [
  { value: "4", label: "Programmes" },
  { value: "PIA", label: "Governed by" },
  { value: "100%", label: "Transparent" },
  { value: "NIN", label: "One Account" },
];

export default function Hero() {
  return (
    <section className={styles.hero}>

      {/* BACKGROUND */}
      <div className={styles.gradientBg} />
      <div className={styles.glowGreen} />
      <div className={styles.glowAmber} />

      <div className={styles.container}>

        {/* LEFT SIDE */}
        <div className={styles.left}>

          {/* LABEL */}
          <div className={styles.label}>
            <span className={styles.labelDot} />
            Royal Mbo Community Development Trust
          </div>

          {/* HEADING */}
          <h1 className={styles.heading}>
            Empowering
            <br />
            <span className={styles.headingAccent}>Mbo Youth</span>
            <br />
            Through Opportunity
          </h1>

          {/* SUBTEXT */}
          <p className={styles.subtext}>
            Empowering Mbo youth through scholarships, grants,
            training, and funding opportunities for growth.
            Built on fairness, transparency, and accountability.
          </p>

          {/* BUTTONS */}
          <div className={styles.buttons}>
            <Link href="/register" className={styles.btnPrimary}>
              Start Application
              <ArrowRight size={16} className={styles.btnArrow} />
            </Link>
            <a href="#how-it-works" className={styles.btnSecondary}>
              How It Works
            </a>
          </div>

          {/* STATS */}
          <div className={styles.statsRow}>
            {stats.map((stat, i) => (
              <div key={i} className={styles.statItem}>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className={styles.right}>
          <div className={styles.cardsGrid}>
            {programmes.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={i}
                  className={styles.card}
                  style={{
                    backgroundColor: p.bg,
                    borderColor: p.border,
                    animationDelay: (i * 0.1) + "s",
                  }}
                >
                  <div
                    className={styles.cardIconBox}
                    style={{ backgroundColor: p.accent }}
                  >
                    <Icon size={18} color="#ffffff" strokeWidth={2} />
                  </div>
                  <div className={styles.cardContent}>
                    <span className={styles.cardTitle}>{p.title}</span>
                    <span className={styles.cardDesc}>{p.desc}</span>
                  </div>
                  <ArrowRight
                    size={16}
                    className={styles.cardArrow}
                    style={{ color: p.accent }}
                  />
                </div>
              );
            })}
          </div>

          {/* TRUST BADGE */}
          <div className={styles.trustBadge}>
            <div className={styles.trustIconBox}>
              <ShieldCheck size={22} color="#15803d" strokeWidth={2} />
            </div>
            <div className={styles.trustText}>
              <span className={styles.trustTitle}>NIN-Verified System</span>
              <span className={styles.trustDesc}>
                Every application automatically verified
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}