/**
 * Where to go after signing in: only a path on this site. Anything that could
 * be read as another origin ("//evil", "/\\evil", "https://…") falls back to the lobby.
 */
export function safeCallback(url: string | null | undefined, fallback = '/app'): string {
  if (!url || !url.startsWith('/') || /[\\\u0000-\u001f]/.test(url) || url.startsWith('//')) return fallback;
  try {
    const base = 'https://codebattle.invalid';
    const resolved = new URL(url, base);
    if (resolved.origin !== base) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
