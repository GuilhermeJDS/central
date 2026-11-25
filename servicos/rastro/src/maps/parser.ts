import type { Page } from "playwright";
import type { MapsLead, MapsFilters } from "./types";

function clean(value?: string | null) { return value?.replace(/^[^:]+:\s*/, "").trim() || undefined; }
function number(text?: string) { if (!text) return undefined; const value = Number(text.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")); return Number.isFinite(value) ? value : undefined; }
function externalId(url: string) { return url.match(/!1s([^!/?]+)/)?.[1] || url.match(/place\/[^/]+\/data=.*!1s([^!]+)/)?.[1]; }

export async function extractVisibleBusinessData(page: Page, base: { segment: string; locality: string; region?: string | null; country: string; mapsUrl: string }): Promise<MapsLead | null> {
  const title = await page.locator("h1").first().textContent().catch(() => null);
  if (!title?.trim()) return null;
  const labelled = async (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const item = page.locator("button[aria-label], a[aria-label]").filter({ has: page.locator("xpath=.") });
      const count = await item.count();
      for (let i = 0; i < Math.min(count, 100); i++) { const label = await item.nth(i).getAttribute("aria-label"); if (label && pattern.test(label)) return clean(label); }
    }
  };
  const address = await labelled([/^Endereço:/i, /^Address:/i]);
  const phone = await labelled([/^Telefone:/i, /^Phone:/i]);
  const siteLink = page.locator('a[data-item-id="authority"], a[aria-label^="Site:" i], a[aria-label^="Website:" i]').first();
  const website = await siteLink.getAttribute("href").catch(() => null) || undefined;
  const body = (await page.locator("main").innerText().catch(() => page.locator("body").innerText())).slice(0, 12000);
  const ratingMatch = body.match(/(?:^|\n)([1-5][,.]\d)\s*(?:\n|\()/);
  const reviewsMatch = body.match(/([\d.]+)\s+(?:avaliações|reviews)/i);
  const category = await page.locator('button[jsaction*="category"], [aria-label*="Categoria" i]').first().textContent().catch(() => null) || undefined;
  const mapsUrl = page.url().includes("/maps/place/") ? page.url() : base.mapsUrl;
  return { companyName: title.trim(), segment: base.segment, locality: base.locality, region: base.region || undefined, country: base.country, phone, website, address, rating: number(ratingMatch?.[1]), reviewsCount: number(reviewsMatch?.[1]), externalSource: "google-maps-browser", externalId: externalId(mapsUrl), mapsUrl, category: category?.trim(), operational: !/Fechado permanentemente|Permanently closed/i.test(body) };
}

export function matchesFilters(lead: MapsLead, filters: MapsFilters) {
  return (!filters.hasPhone || Boolean(lead.phone)) && (filters.website === "any" || (filters.website === "yes") === Boolean(lead.website)) && (lead.rating || 0) >= filters.minRating && (lead.reviewsCount || 0) >= filters.minReviews && (!filters.operational || lead.operational !== false);
}
