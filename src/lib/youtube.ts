const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const PATH_MARKERS = new Set(["embed", "shorts", "live", "v"]);

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isYoutubeHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtu.be"
  );
}

function idFromPathSegments(segments: string[]): string | null {
  for (let i = 0; i < segments.length - 1; i++) {
    if (PATH_MARKERS.has(segments[i].toLowerCase()) && YOUTUBE_ID_RE.test(segments[i + 1])) {
      return segments[i + 1];
    }
  }
  return null;
}

/**
 * Extrai o video ID de URLs longas e curtas do YouTube.
 * Aceita, entre outros:
 * - https://www.youtube.com/watch?v=ID
 * - https://youtu.be/ID
 */
export function extractYoutubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(
      /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`,
    );

    if (isYoutubeHost(parsed.hostname)) {
      const host = normalizeHost(parsed.hostname);
      const segments = parsed.pathname.split("/").filter(Boolean);

      // Formato curto: youtu.be/ID
      if (host === "youtu.be") {
        const id = segments[0]?.split("?")[0] ?? "";
        if (YOUTUBE_ID_RE.test(id)) return id;
      }

      // watch?v=ID (v pode não ser o primeiro query param)
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery && YOUTUBE_ID_RE.test(fromQuery)) return fromQuery;

      // /embed/ID, /shorts/ID, /live/ID, /v/ID
      const fromPath = idFromPathSegments(segments);
      if (fromPath) return fromPath;
    }
  } catch {
    // URL malformada — cai no fallback por regex.
  }

  // Fallback para strings parciais / coladas sem esquema.
  const fallback =
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i.exec(
      trimmed,
    );

  return fallback?.[1] ?? null;
}

export function isValidYoutubeUrl(url: string): boolean {
  return extractYoutubeVideoId(url) !== null;
}

export function getYoutubeThumbnailUrl(url: string): string | null {
  const id = extractYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

export function getYoutubeEmbedUrl(url: string): string | null {
  const id = extractYoutubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
}

/** Formata segundos como m:ss ou h:mm:ss. */
export function formatarDuracaoVideo(segundos: number | null | undefined): string | null {
  if (segundos == null || !Number.isFinite(segundos) || segundos < 0) {
    return null;
  }
  const total = Math.floor(segundos);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
