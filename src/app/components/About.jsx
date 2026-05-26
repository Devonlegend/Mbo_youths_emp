import { ShieldCheck, Scale, Lock, FileCheck } from "lucide-react";
import styles from "./About.module.css";

const values = [
  {
    icon: ShieldCheck,
    title: "Transparency",
    desc: "Every decision is documented and auditable under PIA obligations. Nothing is hidden.",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    icon: Scale,
    title: "Equity",
    desc: "One beneficiary per category per cycle. No double-dipping, no favoritism.",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  {
    icon: Lock,
    title: "Security",
    desc: "NIN-based verification closes the multi-account loophole at registration.",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  {
    icon: FileCheck,
    title: "Accountability",
    desc: "Permanent immutable beneficiary records available to auditors at any time.",
    color: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
];

export default function About() {
  return (
    <section className={styles.about} id="about">
      <div className={styles.container}>

        {/* TOP */}
        <div className={styles.top}>
          <div className={styles.left}>
            <div className={styles.label}>
              <span className={styles.labelDot} />
              About the Trust
            </div>
            <h2 className={styles.heading}>
              Built for Mbo.
              <br />
              <span className={styles.headingAccent}>Governed by Law.</span>
            </h2>
          </div>

          <div className={styles.right}>
            <p className={styles.text}>
              The Royal Mbo Host Community Development Trust (RMHCDT) was
              established under the Petroleum Industry Act, 2021 (PIA) to
              channel community development funds directly to the people of
              the Mbo host community.
            </p>
            <p className={styles.text}>
              This portal brings transparency and accountability to every
              stage of the beneficiary selection process from application
              to approval ensuring that support reaches those who truly
              deserve it.
            </p>
          </div>
        </div>

        {/* DIVIDER */}
        <div className={styles.divider} />

        {/* VALUE CARDS */}
        <div className={styles.valuesGrid}>
          {values.map((v, i) => {
            const Icon = v.icon;
            return (
              <div
                key={i}
                className={styles.valueCard}
                style={{ borderColor: v.border }}
              >
                <div
                  className={styles.iconBox}
                  style={{
                    background: v.bg,
                    border: "1.5px solid " + v.border,
                  }}
                >
                  <Icon size={20} color={v.color} strokeWidth={2} />
                </div>
                <h3 className={styles.valueTitle}>{v.title}</h3>
                <p className={styles.valueDesc}>{v.desc}</p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}