/** UUID, serialised as a string by DRF. */
export type UUID = string;

/** "YYYY-MM-DD" */
export type ISODate = string;

/** ISO 8601 datetime, e.g. "2026-10-11T09:30:00Z" */
export type ISODateTime = string;

/** DRF DecimalField. Serialised as a string (COERCE_DECIMAL_TO_STRING is at its default). */
export type DecimalValue = string;

/** DRF PageNumberPagination envelope (page size 50 by default). */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Simple `{ message }` success body used by most auth endpoints. */
export interface MessageResponse {
  message: string;
}