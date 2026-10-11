import type { ISODateTime, UUID } from "./common";

export type NotificationType =
  | "application"
  | "deadline"
  | "programme"
  | "profile"
  | "system"
  | "alert"
  | "welcome";

// Named AppNotification so it does not clash with the browser's global
// `Notification` type.
export interface AppNotification {
  id: UUID;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  time: ISODateTime; // the backend's created_at
}