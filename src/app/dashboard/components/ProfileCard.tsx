import { MapPin, CalendarDays, ArrowRight } from "lucide-react";
import styles from "./ProfileCard.module.css";

interface ProfileCardUser {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  passport_photo?: string | null;
}

interface ProfileCardProps {
  user?: ProfileCardUser | null;
  onEdit?: () => void;
}

export default function ProfileCard({ user, onEdit }: ProfileCardProps) {
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
          <>
            <img
              src={user.passport_photo}
              alt={fullName}
              className={styles.avatarImg}
              onError={(e) => {
                const img = e.currentTarget;
                img.style.display = 'none';
                const fallback = img.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className={styles.avatarInitials} style={{ display: 'none' }}>
              {initials}
            </div>
          </>
        ) : (
          <div className={styles.avatarInitials}>{initials}</div>
        )}
      </div>

      {/* INFO */}
      <div className={styles.info}>
        <p className={styles.name}>{fullName}</p>
        <p className={styles.email}>{user?.email || ""}</p>
        <p className={styles.phone}>{user?.phone || ""}</p>
      </div>

      {/* ACTION */}
      <button className={styles.profileBtn} onClick={onEdit}>
        View Profile <ArrowRight size={13} strokeWidth={2} />
      </button>

    </div>
  );
}