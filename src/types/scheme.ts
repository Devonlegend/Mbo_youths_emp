import type { DecimalValue, ISODate, ISODateTime, UUID } from "./common";
import type { ProgrammeType } from "./student";

export type AwardType = "scholarship" | "empowerment" | "grant";

export type StackingPolicy = "exclusive" | "major_only" | "open";

export type ProviderType = "lga" | "state" | "corporate" | "ngo" | "federal";

export interface SchemeProvider {
  id: UUID;
  name: string;
  provider_type: ProviderType;
}

export interface CreateProviderRequest {
  name: string;
  provider_type: ProviderType;
}

export interface Cycle {
  id: UUID;
  name: string;
  start_year: number;
  end_year: number;
  is_active: boolean;
}

export interface EligibilityCriteria {
  min_cgpa?: number;
  allowed_levels?: string[];
  min_age?: number;
  max_age?: number;
  allowed_trades?: string[];
  ward_restriction?: string[] | null;
  max_prior_awards?: number;
}

/** Response of GET /schemes/<id>/ , and of create / update. */
export interface Scheme {
  id: UUID;
  provider: SchemeProvider;
  cycle: Cycle | null;
  name: string;
  award_type: AwardType;
  award_type_display: string;
  description: string;
  academic_year: string;
  award_amount: DecimalValue;
  total_slots: number;
  remaining_slots: number;
  stacking_policy: StackingPolicy;
  eligibility_criteria: EligibilityCriteria;
  is_recurring: boolean;
  min_renewal_cgpa: DecimalValue | null; // 5.0 scale
  applicable_programme_types: ProgrammeType[];
  application_open_date: ISODate;
  application_close_date: ISODate;
  is_active: boolean;
  is_published: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/**
 * Body for creating or updating a scheme. The eligibility inputs are sent as
 * top-level fields; the backend builds `eligibility_criteria` from them.
 * Lists may be sent as arrays or comma-separated strings. Numbers may arrive
 * as strings from form inputs. Use Partial<SchemeWriteRequest> for PATCH.
 */
export interface SchemeWriteRequest {
  name: string;
  award_type: AwardType;
  description: string;
  academic_year: string;
  award_amount: number | string;
  total_slots: number | string;
  stacking_policy?: StackingPolicy;
  application_open_date: ISODate;
  application_close_date: ISODate;
  cycle_id?: UUID | null;
  provider_id?: UUID | null;
  is_active?: boolean;
  is_published?: boolean;
  min_cgpa?: number | string;
  allowed_levels?: string[] | string;
  min_age?: number | string;
  max_age?: number | string;
  allowed_trades?: string[] | string;
  ward_restriction?: string[] | string | null; // "" clears it on update
  max_prior_awards?: number | string;
  // Recurring award settings (scholarships only)
  is_recurring?: boolean;
  min_renewal_cgpa?: number | string | null; // 5.0 scale; "" or null clears it on update
  applicable_programme_types?: ProgrammeType[] | string; // array or comma-separated
}

export interface PublishSchemeResponse {
  status: string;
  is_published: boolean;
  is_active: boolean;
}

/** Response of close and reopen. */
export interface SchemeActiveResponse {
  status: string;
  is_active: boolean;
}

export type SchemeFieldType = "text" | "number" | "select" | "textarea" | "file";

/** One entry of GET /schemes/<id>/fields/ */
export interface SchemeField {
  field_name: string;
  field_label: string;
  field_type: SchemeFieldType;
  placeholder: string;
  is_required: boolean;
  section: string;
  options: string[];
}