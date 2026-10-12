import type { ProgrammeType } from "@/types/student";

/** Programme types, in the order they appear in forms. Values match the backend. */
export const PROGRAMME_TYPE_OPTIONS: { value: ProgrammeType; label: string }[] = [
  { value: "undergraduate", label: "Undergraduate" },
  { value: "hnd", label: "HND" },
  { value: "postgraduate_taught", label: "Postgraduate (taught)" },
  { value: "postgraduate_research", label: "Postgraduate (research)" },
];

/**
 * Programme lengths (in years) a student can pick for each programme type.
 * Undergraduate: 4, 5 or 6 (Medicine and Dentistry are 6).
 */
export const DURATION_OPTIONS: Record<ProgrammeType, number[]> = {
  undergraduate: [4, 5, 6],
  hnd: [2],
  postgraduate_taught: [1, 2],
  postgraduate_research: [2, 3, 4],
};

/** "postgraduate_taught" -> "Postgraduate (taught)". Unknown values come back unchanged. */
export function programmeTypeLabel(value: string): string {
  return PROGRAMME_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}