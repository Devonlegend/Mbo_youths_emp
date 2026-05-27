import { MapPin, CalendarDays, ArrowRight } from "lucide-react";
import styles from "./ProfileCard.module.css";

export default function ProfileCard({ user, onEdit }) {
  const initials =
    (user?.first_name?.[0]?.toUpperCase() || "") +
    (user?.last_name?.[0]?.toUpperCase() || "");

  const fullName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
    : "Chukwu Harrison";

  return (
    <div className={styles.card}>

      {/* AVATAR */}
      <div className={styles.avatarWrap}>
        {user?.passport_photo ? (
          <img src={user.passport_photo} alt={fullName} className={styles.avatarImg} />
        ) : (
          <div className={styles.avatarInitials}>{initials}</div>
        )}
      </div>

      {/* INFO */}
      <div className={styles.info}>
        <p className={styles.name}>{fullName}</p>
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <MapPin size={11} strokeWidth={2} />
            {user?.lga || "Mbo LGA"}, Akwa Ibom State
          </span>
          <span className={styles.metaDot} />
          <span className={styles.metaItem}>
            <CalendarDays size={11} strokeWidth={2} />
            Member since {user?.member_since || "January 2026"}
          </span>
        </div>
        <p className={styles.hint}>
          Keep your profile up to date to stay eligible for all programmes this cycle.
        </p>
      </div>

      {/* ACTION */}
      <button className={styles.profileBtn} onClick={onEdit}>
        View Profile <ArrowRight size={13} strokeWidth={2} />
      </button>

    </div>
  );
}