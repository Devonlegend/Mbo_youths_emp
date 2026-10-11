export interface Bank {
  name: string;
  code: string;
}

/** Response of GET /verification/banks/ */
export interface BanksResponse {
  banks: Bank[];
}

/** Body of POST /verification/bank/ ; account_number must be exactly 10 digits. */
export interface ResolveBankRequest {
  account_number: string;
  bank_code: string;
}

/**
 * `score` and `overlap_tokens` are absent when either name is empty or the
 * user has no student profile.
 */
export interface BankNameMatch {
  passed: boolean;
  score?: number;
  overlap_tokens?: string[];
  detail?: string;
}

/** Response of POST /verification/bank/ (errors come back as { error } with 400). */
export interface ResolveBankResponse {
  success: true;
  account_name: string;
  account_number: string;
  name_match: BankNameMatch;
  warning: string | null; // set when the names do not match
}