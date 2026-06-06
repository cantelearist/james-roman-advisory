export function safeInternalPath(value: string | null | undefined, fallback = "/office") {
  if (!value) return fallback;

  try {
    const parsed = new URL(value, "https://www.jamesroman.la");
    if (parsed.origin !== "https://www.jamesroman.la") return fallback;
    if (!parsed.pathname.startsWith("/")) return fallback;
    if (parsed.pathname.startsWith("//")) return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
