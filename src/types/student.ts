import type { UUID } from "./common";
import type { Gender } from "./user";

export type ProgrammeType =
  | "undergraduate"
  | "hnd"
  | "postgraduate_taught"
  | "postgraduate_research";

/** Response of GET /students/me/ and GET /students/<id>/ */
export interface Student {
  user_id: UUID;
  email: string;
  firstname: string;
  lastname: string;
  phone_number: string;
  gender: Gender;
  ward: string;
  lga: string;
  nin_slip: string | null; // file URL
  certificate: string | null; // file URL
  passport: string | null; // URL taken from the linked User
  is_verified: boolean;
  active_award: string; // empty string when none
  has_active_award: boolean;
  faculty: string; // empty string when not set
  programme_type: ProgrammeType | ""; // empty string when not set
  programme_duration_years: number | null;
  entry_level: number | null; // 100 or 200; only for undergraduates
}

/** Response of GET /students/bank/ and PATCH /students/bank/ */
export interface BankDetail {
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
}

/** PATCH /students/bank/ accepts any subset of the fields. */
export type BankDetailUpdate = Partial<BankDetail>;

/** Response of GET /students/stats/ */
export interface StudentStats {
  total_students: number;
  verified: number;
  unverified: number;
  with_active_award: number;
  by_ward: Record<string, number>;
}

export type VerifyDecision = "approved" | "rejected";

/** Body of PATCH /students/<id>/verify/ ; notes is required when rejecting. */
export interface VerifyStudentRequest {
  decision: VerifyDecision;
  notes?: string;
}

export interface VerifyStudentResponse {
  is_verified: boolean;
  verification_rejection_reason: string;
}

/** Academic fields a student can save on their profile (all optional). */
export interface AcademicProfileUpdate {
  faculty?: string;
  programme_type?: ProgrammeType | "";
  programme_duration_years?: number | null;
  entry_level?: number | null;
}