import Link from "next/link";
import { ArrowRight, GraduationCap, Briefcase, Wrench, Banknote } from "lucide-react";
import styles from "./CTABanner.module.css";

const icons = [GraduationCap, Briefcase, Wrench, Banknote];

export default function CTABanner() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>

        {/* FLOATING ICONS */}
        <div className={styles.floatingIcons}>
          {icons.map((Icon, i) => (
            <div key={i} className={styles.floatingIcon} style={{ animationDelay: (i * 0.4) + "s" }}>
              <Icon size={20} color="rgba(183, 242, 204)" strokeWidth={1.5} />
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div className={styles.content}>
          <div className={styles.label}>
            <span className={styles.labelDot} />
            2026 — 2027 Cycle Now Open
          </div>

          <h2 className={styles.heading}>
            Your Opportunity
            <br />
            <span className={styles.headingAccent}>Is Waiting.</span>
          </h2>

          <p className={styles.subtext}>
            The current cycle is open. Create your account, complete
            your application, and take the next step toward education,
            empowerment, and growth.
          </p>

          <div className={styles.buttons}>
            <Link href="/register" className={styles.btnPrimary}>
              Create Account
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
            <Link href="/login" className={styles.btnSecondary}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
      
    </section>
  );
}