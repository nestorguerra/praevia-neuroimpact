function normalizedBasePath() {
  const rawBase = import.meta.env.BASE_URL || "/";
  const pathname = new URL(rawBase, window.location.origin).pathname;
  const trimmed = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return trimmed === "" ? "" : trimmed;
}

export function normalizeRoutePath(pathname: string) {
  const base = normalizedBasePath();
  if (!base) return pathname || "/";
  if (pathname === base) return "/";
  if (pathname.startsWith(`${base}/`)) {
    return pathname.slice(base.length) || "/";
  }
  return pathname || "/";
}

export function publicHref(href: string | undefined) {
  if (!href) return href;
  if (href.startsWith("#") || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
    return href;
  }
  if (!href.startsWith("/")) return href;
  const base = normalizedBasePath();
  if (!base) return href;
  return `${base}${href}`;
}

