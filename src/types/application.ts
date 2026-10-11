import type { DecimalValue, ISODate, ISODateTime, UUID } from "./common";
import type { AwardType, SchemeProvider } from "./scheme";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "eligibility_check"
  | "double_dip_flag"
  | "document_review"
  | "shortlisted"
  | "approved"
  | "rejected"
  | "waiver_required"
  | "withdrawn";

export type ReviewDecision = "approved" | "rejected" | "shortlisted";

/**
 * Student block nested inside an application.
 * `level` and `cgpa`: the Student model no longer has these fields, so the
 * API returns null for both.
 */
export interface ApplicationStudent {
  id: UUID;
  full_name: string;
  ward: string;
  level: string | null;
  cgpa: DecimalValue | null;
  nimc_verified: boolean;
}

/** Scheme block nested inside an application. */
export interface ApplicationScheme {
  id: UUID;
  name: string;
  award_type: AwardType;
  award_type_display: string;
  award_amount: DecimalValue;
  academic_year: string;
  application_open_date: ISODate;
  application_close_date: ISODate;
  provider: SchemeProvider;
}

export interface BankDetails {
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  name_match_passed: boolean;
}

export interface ScholarshipAnswers {
  institution_name: string;
  course_of_study: string;
  current_level: string;
  cgpa: DecimalValue;
  admission_year: number;
  matric_number: string;
}

export interface EmpowermentAnswers {
  trade_or_skill: string;
  training_provider: string;
  training_duration_months: number | null;
  prior_experience: string;
}

export type BusinessStage = "idea" | "startup" | "growth" | "mature";

export interface GrantAnswers {
  business_name: string;
  business_stage: BusinessStage;
  business_description: string;
  requested_amount: DecimalValue;
  intended_use: string;
}

/**
 * Bank snapshot plus only the answer keys for the scheme's award_type.
 * Check `application.scheme.award_type` to know which keys are present.
 */
export type ApplicationDetails = BankDetails &
  Partial<ScholarshipAnswers & EmpowermentAnswers & GrantAnswers>;

export interface PriorSupport {
  organisation: string;
  category: string;
  year: number;
}

/** Compact shape used by list endpoints. */
export interface ApplicationListItem {
  id: UUID;
  student: ApplicationStudent;
  scheme: ApplicationScheme;
  status: ApplicationStatus;
  status_display: string;
  submission_date: ISODateTime | null;
  eligibility_passed: boolean | null;
  has_conflict: boolean;
  waiver_submitted: boolean;
  can_waive: boolean;
  created_at: ISODateTime;
}

/** Full shape returned for a single application. */
export interface Application {
  id: UUID;
  student: ApplicationStudent;
  scheme: ApplicationScheme;
  status: ApplicationStatus;
  status_display: string;
  submission_date: ISODateTime | null;
  details: ApplicationDetails;
  self_declaration_received_support: boolean | null;
  self_declaration_details: PriorSupport[];
  attestation_agreed: boolean;
  attestation_at: ISODateTime | null;
  documents: Record<string, string>;
  eligibility_passed: boolean | null;
  eligibility_details: Record<string, unknown>; // shape comes from EligibilityEngine
  has_conflict: boolean;
  conflict_scheme_ids: string[];
  waiver_submitted: boolean;
  reviewer_notes: string;
  rejection_reason: string;
  reviewed_at: ISODateTime | null;
  can_waive: boolean;
  can_review: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ApplicationStatusHistoryEntry {
  id: UUID;
  application_id: UUID;
  from_status: ApplicationStatus;
  to_status: ApplicationStatus;
  reason: string;
  changed_by_email: string; // "System" when there is no user
  changed_at: ISODateTime;
}

/** Flat disbursement record from the approved-list endpoint. */
export interface ApprovedApplication {
  application_id: UUID;
  student_id: UUID;
  full_name: string;
  phone_number: string;
  email: string;
  ward: string;
  scheme: {
    id: UUID;
    name: string;
    award_type: AwardType;
    academic_year: string;
  };
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  approved_at: ISODateTime | null;
  reviewed_at: ISODateTime | null;
}

// ── Requests and responses ──────────────────────────────────────────────────

/** Query filters for GET /applications/ (staff only; students always get their own). */
export interface ApplicationListParams {
  status?: ApplicationStatus;
  scheme?: UUID;
}

/**
 * The JSON that goes in the `payload` text part of the multipart submit
 * request; documents go in as file parts keyed by field name.
 */
export interface SubmitApplicationPayload {
  scheme_id: UUID;
  programme_answers: Record<string, unknown>;
  bank_account_number: string;
  bank_code: string;
  bank_name: string;
  bank_account_name: string;
  bank_name_match_passed?: boolean;
  self_declaration_received_support: boolean;
  self_declaration_details?: PriorSupport[]; // required when received_support is true
  attestation_agreed: boolean;
  documents?: Record<string, string>;
}

export interface SubmitApplicationResponse {
  application_id: UUID;
  status: ApplicationStatus;
  eligible: boolean;
  has_conflict: boolean;
  conflict_details: string[];
  checks: Record<string, unknown>; // shape comes from EligibilityEngine
  message: string;
}

export interface ReviewApplicationRequest {
  decision: ReviewDecision;
  notes?: string; // required by the backend when rejecting
}

export interface ReviewApplicationResponse {
  message: string;
  status: ApplicationStatus;
  note: string | null;
}

export interface PublishApprovalsResponse {
  sent: number;
  scheme: string; // scheme name
}

/** One entry of GET /applications/schemes-overview/ */
export interface SchemesOverviewItem {
  scheme: {
    id: UUID;
    name: string;
    award_type: AwardType;
    total_slots: number;
    remaining_slots: number;
  };
  pending_review: number;
  unpublished: number;
}

/** Response of GET /applications/by-scheme/<id>/ */
export interface ApplicationsByScheme {
  scheme: {
    id: UUID;
    name: string;
    award_type: AwardType;
    total: number;
  };
  pending_review: number;
  unpublished: number;
  applications: Application[];
}

/** Response of GET /applications/approved-list/ (JSON mode) */
export interface ApprovedListResponse {
  scheme: {
    id: UUID;
    name: string;
    award_type: AwardType;
    academic_year: string;
    total_slots: number;
    remaining_slots: number;
  };
  count: number;
  applications: ApprovedApplication[];
}