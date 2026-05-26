"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./FAQ.module.css";

const faqs = [
  {
    q: "Who is eligible to apply?",
    a: "You must be a member of the Royal Mbo host community, meet the specific criteria stated in the programme announcement, submit a complete application with a valid self-declaration, and not be under any active disqualification from the Trust.",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    q: "Can I apply for more than one programme?",
    a: "Yes. You can apply to multiple open programmes simultaneously. However, you can only receive one award per programme category per cycle. For example, you can receive a Scholarship and a Grant in the same cycle, but not two Scholarships.",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  {
    q: "What if I received support from another organisation?",
    a: "You must declare it in your self-declaration. The system will flag it for administrative review. This does not automatically disqualify you an administrator will review the details and make a documented decision.",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  {
    q: "What happens if I provide false information?",
    a: "A false declaration results in immediate rejection. First offence means disqualification for the current and next full cycle. A second offence results in permanent disqualification from all Trust programmes.",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
  },
  {
    q: "How does NIN verification work?",
    a: "Your National Identification Number is used to create and verify your account. One NIN can only be registered once. Every application is automatically checked against prior beneficiary records using your NIN.",
    color: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
  {
    q: "When does the cycle reset?",
    a: "The Trust's funding cycle runs from 1st April to 31st March each year. All per-cycle exclusions reset on 1st April. If you were a beneficiary in the previous cycle, you are eligible to apply again in the new cycle.",
    color: "#0e7490",
    bg: "#ecfeff",
    border: "#a5f3fc",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  function toggle(i) {
    setOpen(open === i ? null : i);
  }

  return (
    <section className={styles.section} id="faq">
      <div className={styles.container}>

        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.label}>
            <span className={styles.labelDot} />
            FAQ
          </div>
          <h2 className={styles.heading}>
            Common
            <span className={styles.headingAccent}> Questions</span>
          </h2>
          <p className={styles.subtext}>
            Everything you need to know before applying.
          </p>
        </div>

        {/* GRID */}
        <div className={styles.grid}>
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={styles.card + " " + (open === i ? styles.cardOpen : "")}
              style={{
                borderColor: open === i ? faq.border : "#e2e8f0",
                background: open === i ? faq.bg : "#ffffff",
              }}
              onClick={() => toggle(i)}
            >
              {/* TOP ROW */}
              <div className={styles.top}>
                <div
                  className={styles.num}
                  style={{ color: faq.color }}
                >
                  0{i + 1}
                </div>
                <span className={styles.question}>{faq.q}</span>
                <div
                  className={styles.chevron + " " + (open === i ? styles.chevronOpen : "")}
                  style={{ color: open === i ? faq.color : "#94a3b8" }}
                >
                  <ChevronDown size={18} strokeWidth={2.5} />
                </div>
              </div>

              {/* ANSWER */}
              <div className={styles.answerWrap + " " + (open === i ? styles.answerWrapOpen : "")}>
                <p
                  className={styles.answer}
                  style={{ borderTopColor: faq.border }}
                >
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}