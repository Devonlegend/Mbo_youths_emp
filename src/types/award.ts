import type { DecimalValue, ISODateTime, Paginated, UUID } from "./common";
import type { AwardType } from "./scheme";
import type { ProgrammeType } from "./student";

// ── Status values (mirror mbo_youth_emp/awards/models.py) ───────────────────

export type AwardStatus = "active" | "suspended" | "graduated" | "terminated";

export type InstallmentStatus =
  | "pending_renewal" // student's turn: the renewal form is open
  | "pending_verification" // submitted, waiting on staff
  | "approved" // verified, waiting to be paid
  | "disbursed" // paid (final)
  | "withheld" // CGPA below threshold, award suspended
  | "cancelled"; // never submitted, or rejected twice; award suspended

export type AppealStatus = "pending" | "upheld" | "rejected";

export type CgpaScale = "5.0" | "4.0";

/** How sure the backend is about `total_years`. Anything but "confirmed" needs a human check. */
export type TenureConfidence = "confirmed" | "inferred" | "degraded";

// ── Small nested blocks ─────────────────────────────────────────────────────

export interface AwardSchemeBrief {
  id: UUID;
  name: string;
  award_type: AwardType;
  provider: { id: UUID; name: string } | null;
}

export interface CycleBrief {
  id: UUID;
  name: string; // "2026/2027"
}

export interface AwardStudentBrief {
  id: UUID;
  full_name: string;
  email: string;
  ward: string;
}

// ── Installment (one payment year) ──────────────────────────────────────────

export interface Installment {
  id: UUID;
  year_index: number; // 1-based payment year
  cycle: CycleBrief;
  status: InstallmentStatus;
  status_display: string;
  is_open: boolean; // true for pending_renewal and pending_verification
  amount: DecimalValue;
  threshold: DecimalValue; // minimum CGPA (5.0 scale) this year is judged on
  submitted_cgpa: DecimalValue | null;
  submitted_cgpa_scale: CgpaScale | "";
  submitted_cgpa_normalized: DecimalValue | null; // 5.0-scale value used for the check
  submitted_level: string;
  transcript: string | null; // file URL
  verifier_note: string;
  verified_at: ISODateTime | null;
  resubmission_count: number; // rejections so far; the cap is 2
  disbursed_at: ISODateTime | null;
  disbursement_ref: string;
  created_at: ISODateTime;
}

/** The award context that comes with each row of the staff renewal queue. */
export interface RenewalQueueAward {
  id: UUID;
  status: AwardStatus;
  total_years: number;
  current_year_index: number;
  student: AwardStudentBrief;
  scheme: AwardSchemeBrief | null;
  start_cycle: CycleBrief | null;
}

export interface RenewalQueueItem extends Installment {
  award: RenewalQueueAward;
}

// ── Appeal ──────────────────────────────────────────────────────────────────

export interface AppealInstallmentBrief {
  id: UUID;
  year_index: number;
  status: InstallmentStatus;
}

export interface AppealAwardBrief {
  id: UUID;
  status: AwardStatus;
  total_years: number;
  current_year_index: number;
  student: AwardStudentBrief;
  scheme: AwardSchemeBrief | null;
}

export interface Appeal {
  id: UUID;
  status: AppealStatus;
  status_display: string;
  reason: string;
  evidence: string | null; // file URL
  installment: AppealInstallmentBrief;
  award: AppealAwardBrief;
  reviewed_by: { id: UUID; full_name: string } | null;
  reviewed_at: ISODateTime | null;
  review_note: string;
  created_at: ISODateTime;
}

// ── Award ───────────────────────────────────────────────────────────────────

/**
 * Row of the staff register (GET /awards/).
 * `current_year_index` counts years already PAID: 0 until year 1 is disbursed.
 * The year in progress is `current_year_index + 1`.
 */
export interface AwardListItem {
  id: UUID;
  status: AwardStatus;
  status_display: string;
  scheme: AwardSchemeBrief | null;
  student: AwardStudentBrief;
  annual_amount: DecimalValue;
  total_years: number;
  current_year_index: number;
  start_cycle: CycleBrief | null;
  suspended_reason: string;
  suspended_at: ISODateTime | null;
  tenure_confidence: TenureConfidence;
  tenure_flags: string[];
  created_at: ISODateTime;
}

/** Response of GET /awards/<id>/ and each item of GET /awards/mine/ */
export interface Award extends AwardListItem {
  installments: Installment[];
  /** Non-null means "appeal under review" (a suspended award with a pending appeal). */
  pending_appeal: Appeal | null;
}

/** Stat strip numbers returned next to the paginated register. */
export interface AwardsSummary {
  active: number;
  suspended: number;
  graduated: number;
  terminated: number;
  graduating_this_year: number; // active awards in their final payment year
  committed_annual: DecimalValue; // sum of annual_amount over ACTIVE awards
}

/** Response of GET /awards/ */
export interface AwardsPage extends Paginated<AwardListItem> {
  summary: AwardsSummary;
}

// ── Query params ────────────────────────────────────────────────────────────

export interface AwardListParams {
  status?: AwardStatus;
  scheme?: UUID;
  cycle?: UUID | "active";
  programme_type?: ProgrammeType;
  search?: string;
}

export interface RenewalQueueParams {
  status?: "pending_verification" | "pending_renewal" | "all"; // default: pending_verification
  cycle?: UUID | "active";
}

export interface AppealListParams {
  status?: AppealStatus | "all"; // default: pending
}

export interface AwardsExportParams {
  status?: AwardStatus;
  scheme?: UUID;
  cycle?: UUID | "active";
}

// ── Request bodies ──────────────────────────────────────────────────────────
// renewAward and submitAwardAppeal send multipart FormData:
//   renew:  cgpa, cgpa_scale, level, transcript (file)
//   appeal: reason, evidence (file)

export type VerifyAction = "approve" | "reject" | "withhold";

export interface VerifyInstallmentRequest {
  action: VerifyAction;
  note?: string; // required by the backend UI rules for reject and withhold
}

export interface DisburseRequest {
  disbursement_ref?: string;
}

/** Body of suspend and terminate. */
export interface AwardActionRequest {
  reason?: string;
}

export type AppealDecision = "upheld" | "rejected";

export interface ReviewAppealRequest {
  decision: AppealDecision;
  note?: string;
}

/** Shape of business-rule errors (HTTP 400) from the awards endpoints. */
export interface AwardApiError {
  error: string;
}