import type { LeadInput } from "../validation";

export type MapsLead = LeadInput & { mapsUrl: string; category?: string; operational?: boolean };
export type MapsFilters = { hasPhone: boolean; website: "any" | "yes" | "no"; minRating: number; minReviews: number; operational: boolean };

export class MapsActionRequired extends Error {
  constructor(public readonly reason: string) { super("A busca precisa de intervenção manual."); this.name = "MapsActionRequired"; }
}
