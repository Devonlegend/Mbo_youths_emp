"use client";
import { useState, useEffect } from "react";
import { UserPlus, FileText, ShieldCheck, ClipboardCheck, CheckCircle } from "lucide-react";
import styles from "./HowItWorks.module.css";

const steps = [
  {
    num: "01",
    icon: UserPlus,
    title: "Register",
    short: "Create your account",
    desc: "Create your account with your National Identification Number (NIN). One NIN, one account this is the first safeguard that prevents multiple registrations.",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    light: "#dcfce7",
  },
  {
    num: "02",
    icon: FileText,
    title: "Apply",
    short: "Choose a programme",
    desc: "Choose an open programme, complete the category-specific form, fill your self-declaration of prior support, and submit your application.",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    light: "#fef3c7",
  },
  {
    num: "03",
    icon: ShieldCheck,
    title: "Verification",
    short: "Automatic checks",
    desc: "The system automatically checks your application against all prior beneficiary records, disqualification registers, and declared external support.",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    light: "#dbeafe",
  },
  {
    num: "04",
    icon: ClipboardCheck,
    title: "Review",
    short: "Admin decision",
    desc: "An administrator reviews your application with full evidence. Every decision is documented with a mandatory decision note for audit purposes.",
    color: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
    light: "#f3e8ff",
  },
  {
    num: "05",
    icon: CheckCircle,
    title: "Outcome",
    short: "Get notified",
    desc: "You are notified of the decision. Approved candidates become permanent immutable beneficiary records preventing duplicate awards.",
    color: "#0e7490",
    bg: "#ecfeff",
    border: "#a5f3fc",
    light: "#cffafe",
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % steps.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const ActiveIcon = steps[active].icon;
  const activeStep = steps[active];

  return (
    <section className={styles.section} id="how-it-works">
      <div className={styles.container}>

        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.label}>
            <span className={styles.labelDot} />
            The Process
          </div>
          <h2 className={styles.heading}>
            From Application
            <span className={styles.headingAccent}> to Approval</span>
          </h2>
          <p className={styles.subtext}>
            Five clear steps. Fully transparent. Completely documented.
          </p>
        </div>

        {/* CONTENT */}
        <div className={styles.content}>

          {/* LEFT — STEPS */}
          <div className={styles.steps}>
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = active === i;
              const isDone = active > i;
              return (
                <div
                  key={i}
                  className={styles.step + " " + (isActive ? styles.stepActive : "")}
                  onClick={() => setActive(i)}
                >
                  <div className={styles.stepLeft}>
                    <div
                      className={styles.stepIconBox}
                      style={
                        isActive
                          ? { background: step.color, borderColor: step.color, color: "#fff", boxShadow: "0 4px 16px " + step.color + "44" }
                          : isDone
                          ? { background: step.light, borderColor: step.border, color: step.color }
                          : {}
                      }
                    >
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className={styles.stepLine}
                        style={isDone ? { background: step.color } : {}}
                      />
                    )}
                  </div>
                  <div className={styles.stepRight}>
                    <div className={styles.stepNum}>{step.num}</div>
                    <div
                      className={styles.stepTitle}
                      style={isActive ? { color: "#0f172a" } : {}}
                    >
                      {step.title}
                    </div>
                    <div
                      className={styles.stepShort}
                      style={isActive ? { color: "#64748b" } : {}}
                    >
                      {step.short}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT — PANEL */}
          <div
            className={styles.panel}
            style={{ borderColor: activeStep.border }}
          >
            {/* PANEL TOP COLORED STRIP */}
            <div
              className={styles.panelTop}
              style={{ background: activeStep.bg }}
            >
              <div
                className={styles.panelIconWrap}
                style={{
                  background: activeStep.color,
                  boxShadow: "0 4px 16px " + activeStep.color + "44",
                }}
              >
                <ActiveIcon size={26} color="#ffffff" strokeWidth={2} />
              </div>
              <div
                className={styles.categoryBadge}
                style={{
                  background: activeStep.light,
                  color: activeStep.color,
                  borderColor: activeStep.border,
                }}
              >
                Step {activeStep.num}
              </div>
            </div>

            {/* PANEL BODY */}
            <div className={styles.panelInner}>
              <div className={styles.panelNum}>{activeStep.num}</div>
              <h3
                className={styles.panelTitle}
                style={{ color: activeStep.color }}
              >
                {activeStep.title}
              </h3>
              <p className={styles.panelDesc}>{activeStep.desc}</p>

              {/* DOTS */}
              <div className={styles.dots}>
                {steps.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={styles.dot}
                    style={
                      active === i
                        ? { background: s.color, width: "24px", borderRadius: "4px" }
                        : {}
                    }
                  />
                ))}
              </div>
            </div>

            {/* PROGRESS BAR */}
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: ((active + 1) / steps.length * 100) + "%",
                  background: "linear-gradient(90deg, " + activeStep.color + ", " + activeStep.border + ")",
                }}
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}