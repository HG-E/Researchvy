// apps/web/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getScoreBand } from "@researchvy/shared";

/** Merges Tailwind class names safely (handles conflicting classes). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a number with thousand separators. */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** Returns a score's band label and color for UI badges. */
export { getScoreBand };

/** Converts an ISO date string to a short readable format. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
