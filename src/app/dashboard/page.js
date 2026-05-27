"use client";
import { useRouter } from "next/navigation";
import {
  GraduationCap, Briefcase, Wrench, Banknote,
  ArrowRight, FileUp, Bell, CheckCircle2, Clock, Home, XCircle,
} from "lucide-react";
import ProfileCard from "./components/ProfileCard";
import styles from "./page.module.css";

const mockUser = {
  first_name: "Chukwu",
  last_name: "Harrison",
  lga: "Mbo LGA",
  email: "c.harrison@mail.com",
  nin_masked: "****-***-4521",
  phone_masked: "+234 803 *** 4521",
  passport_photo: null,
  member_since: "January 2026",
};

const eligibility = [
  {
    label: "Scholarship",
    icon: GraduationCap,
    status: "applied",
    statusText: "Pending",
    desc: "2026/2027 University Scholarship",
    color: "green",
  },
  {
    label: "Empowerment",
    icon: Briefcase,
    status: "eligible",
    statusText: "Eligible",
    desc: "No application this cycle",
    color: "amber",
  },
  {
    label: "Training",
    icon: Wrench,
    status: "eligible",
    statusText: "Eligible",
    desc: "No application this cycle",
    color: "blue",
  },
  {
    label: "Grant",
    icon: Banknote,
    status: "awarded",
    statusText: "Awarded",
    desc: "2026 SME Startup Grant",
    color: "purple",
  },
];

const applications = [
  {
    id: 1,
    title: "2026/2027 University Scholarship Award",
    category: "Scholarship",
    categoryColor: "green",
    date: "14 May 2026",
    status: "flagged",
    step: 2,
  },
  {
    id: 2,
    title: "2026 SME Business Startup Grant",
    category: "Grant",
    categoryColor: "purple",
    date: "2 Apr 2026",
    status: "approved",
    step: 3,
  },
];

const STEPS = ["Submitted", "Verified", "Review", "Decision"];

export default function DashboardPage() {
  const router = useRouter();

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className={styles.page}>

      {/* GREETING */}
      <div className={styles.greeting}>
        <p className={styles.greetingDate}>{today}</p>
        <h1 className={styles.greetingTitle}>
          Welcome back,{" "}
          <span className={styles.greetingAccent}>{mockUser.first_name}</span>
          <span className={styles.greetingIcon}>
            <Home size={14} strokeWidth={2.5} />
          </span>
        </h1>
      </div>

      {/* PROFILE CARD */}
        <ProfileCard
          user={mockUser}
          onEdit={() => router.push("/dashboard/profile")}
        />

      {/* CYCLE STATUS */}
      <div>
        <div className={styles.eligGrid}>
          {eligibility.map((e) => {
            const Icon = e.icon;
            return (
              <div key={e.label} className={`${styles.eligCard} ${e.status === "awarded" ? styles.eligAwarded : ""}`}>
                <div className={styles.eligTop}>
                  <div className={`${styles.eligIcon} ${styles[`ei_${e.color}`]}`}>
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <span className={`${styles.eligBadge} ${styles[`eb_${e.status}`]}`}>
                    {e.statusText}
                  </span>
                </div>
                <div className={styles.eligLabel}>{e.label}</div>
                <div className={styles.eligDesc}>{e.desc}</div>
                {e.status === "eligible" && (
                  <button className={styles.eligApplyBtn} onClick={() => router.push("/dashboard/programmes")}>
                    Apply now <ArrowRight size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* APPLICATIONS */}
      <div>
        <div className={styles.secHead}>
          <h2 className={styles.secTitle}>My applications</h2>
          <button className={styles.secLink} onClick={() => router.push("/dashboard/applications")}>
            View all <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>
        <div className={styles.appList}>
          {applications.map((app) => (
            <div
              key={app.id}
              className={`${styles.appCard} ${app.status === "approved" ? styles.appCardApproved : ""}`}
            >
              <div className={styles.appHead}>
                <div className={styles.appLeft}>
                  <div className={styles.appTitle}>{app.title}</div>
                  <div className={styles.appMeta}>
                    <span className={`${styles.catTag} ${styles[`cat_${app.categoryColor}`]}`}>
                      {app.category}
                    </span>
                    <span className={styles.appDate}>Submitted {app.date}</span>
                  </div>
                </div>
                <span className={`${styles.statusTag} ${styles[`st_${app.status}`]}`}>
                  {app.status === "approved" && <CheckCircle2 size={11} strokeWidth={2.5} />}
                  {app.status === "flagged"  && <Clock size={11} strokeWidth={2.5} />}
                  {app.status === "rejected" && <XCircle size={11} strokeWidth={2.5} />}
                  {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                </span>
              </div>

              {/* STEPPER */}
              <div className={styles.stepper}>
                {STEPS.map((s, i) => {
                  const done = i < app.step || (i === app.step && app.status === "approved");
                  const flag = i === app.step && app.status === "flagged";
                  return (
                    <div key={s} className={styles.stepWrap}>
                      <div className={styles.stepRow}>
                        <div className={`${styles.stepDot} ${done ? styles.dotDone : ""} ${flag ? styles.dotFlag : ""}`}>
                          {done ? "✓" : flag ? "!" : i + 1}
                        </div>
                        {i < STEPS.length - 1 && (
                          <div className={`${styles.stepLine} ${i < app.step ? styles.lineDone : ""}`} />
                        )}
                      </div>
                      <div className={`${styles.stepLabel} ${done ? styles.labelDone : ""} ${flag ? styles.labelFlag : ""}`}>
                        {s}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.appFoot}>
                <span className={app.status === "approved" ? styles.footGood : styles.footWarn}>
                  {app.status === "approved" && "Confirmed beneficiary"}
                  {app.status === "flagged"  && "Under admin review "}
                </span>
                <div className={styles.footBtns}>
                  <button className={styles.btnSm}>View</button>
                  {app.status === "approved" && (
                    <button className={styles.btnSmPrimary}>Download Certificate</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <div className={styles.secHead}>
          <h2 className={styles.secTitle}>Quick actions</h2>
        </div>
        <div className={styles.actionGrid}>
          <button className={styles.actionCard} onClick={() => router.push("/dashboard/programmes")}>
            <div className={`${styles.actionIcon} ${styles.aiGreen}`}>
              <GraduationCap size={22} strokeWidth={1.8} />
            </div>
            <div className={styles.actionLabel}>Browse Programmes</div>
            <div className={styles.actionSub}>3 open this cycle</div>
          </button>
          <button className={styles.actionCard} onClick={() => router.push("/dashboard/documents")}>
            <div className={`${styles.actionIcon} ${styles.aiAmber}`}>
              <FileUp size={22} strokeWidth={1.8} />
            </div>
            <div className={styles.actionLabel}>Upload Document</div>
            <div className={styles.actionSub}>2 documents missing</div>
          </button>
          <button className={styles.actionCard} onClick={() => router.push("/dashboard/notifications")}>
            <div className={`${styles.actionIcon} ${styles.aiRed}`}>
              <Bell size={22} strokeWidth={1.8} />
            </div>
            <div className={styles.actionLabel}>Notifications</div>
            <div className={styles.actionSub}>2 unread alerts</div>
          </button>
        </div>
      </div>

    </div>
  );
}