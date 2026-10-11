import type { ISODate, UUID } from "./common";

export type UserRole = "student" | "verifier" | "admin" | "superadmin";

export type Gender = "male" | "female";

/** Response of GET /auth/me/ */
export interface AuthUser {
  id: UUID;
  email: string;
  firstname: string;
  lastname: string;
  phone_number: string;
  role: UserRole;
  passport: string | null; // file URL
  gender: Gender;
  date_of_birth: ISODate | null;
}