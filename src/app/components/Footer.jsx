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
            <img
              src="https://res.cloudinary.com/dwn6p3qmd/image/upload/f_auto,q_auto,w_80,h_80,c_fill,g_face/v1784673040/mboyouths_ssedqs.png"
              alt="RMHCDT"
              className={styles.logoBox}
              width="32"
              height="32"
              loading="lazy"
              decoding="async"
            />
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