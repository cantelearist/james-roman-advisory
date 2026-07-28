const DEFAULT_AUTH_REDIRECT = "/portal";
const REDIRECT_BASE = "https://redirect.invalid";

/**
 * Accept only same-origin application paths for post-authentication navigation.
 * URL parsing catches browser normalization cases such as backslash-based hosts.
 */
export function safeAuthRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }
  if (/[\u0000-\u001f\u007f\\]/.test(value)) {
    return DEFAULT_AUTH_REDIRECT;
  }

  try {
    const parsed = new URL(value, REDIRECT_BASE);
    if (parsed.origin !== REDIRECT_BASE) {
      return DEFAULT_AUTH_REDIRECT;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}
