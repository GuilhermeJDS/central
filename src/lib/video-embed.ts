import {
  extractYoutubeVideoId,
  getYoutubeThumbnailUrl,
} from "@/lib/youtube";

function extractVimeoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(
      /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (
      host === "player.vimeo.com" &&
      segments[0] === "video" &&
      /^\d+$/.test(segments[1] ?? "")
    ) {
      return segments[1] ?? null;
    }
    const last = segments[segments.length - 1];
    if (last && /^\d+$/.test(last)) return last;
  } catch {
    // URL malformada — cai no fallback.
  }

  return /vimeo\.com\/(?:video\/)?(?:channels\/[^/]+\/)?(\d+)/i.exec(trimmed)?.[1] ?? null;
}

export function getVideoEmbedUrl(url: string): string | null {
  const youtubeId = extractYoutubeVideoId(url);
  if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}?rel=0`;
  const vimeoId = extractVimeoId(url);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
  return null;
}

export function getVideoThumbnailUrl(url: string): string | null {
  const youtubeThumb = getYoutubeThumbnailUrl(url);
  if (youtubeThumb) return youtubeThumb;
  const vimeoId = extractVimeoId(url);
  if (vimeoId) return `https://vumbnail.com/${vimeoId}.jpg`;
  return null;
}
