import type { ISODateTime, UUID } from "./common";

export interface AuditLogEntry {
  id: UUID;
  admin_name: string; // "System" when there is no admin
  action: string;
  entity_type: string;
  entity_id: string; // empty string when not applicable
  timestamp: ISODateTime;
}