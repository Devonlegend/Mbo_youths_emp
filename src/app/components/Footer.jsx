import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.divider} />
        <div className={styles.bottom}>
          {/* LEFT: Logo */}
          <Link href="/" className={styles.logo}>
            <div className={styles.logoBox}>
              <span className={styles.logoLetter}>R</span>
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoName}>RMHCDT</span>
              <span className={styles.logoSub}>Youth Portal</span>
            </div>
          </Link>

          {/* RIGHT: Legal links + Copyright stacked */}
          <div className={styles.rightGroup}>
            <div className={styles.legal}>
              <Link href="#" className={styles.legalLink}>Privacy Policy</Link>
              <span className={styles.dot}>·</span>
              <Link href="#" className={styles.legalLink}>Terms of Use</Link>
            </div>
            <p className={styles.copyright}>© 2026 RMHCDT. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}