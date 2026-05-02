import { useEffect, useState } from "react";
import { normalizeRoutePath, publicHref } from "../routing/paths";

export function useRoute() {
  const [path, setPath] = useState(() => normalizeRoutePath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setPath(normalizeRoutePath(window.location.pathname));
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      const nextPath = normalizeRoutePath(url.pathname);
      if (/\.[a-z0-9]+$/i.test(nextPath)) return;
      if (!["/", "/login", "/register", "/forgot", "/pilot-kit"].includes(nextPath) && !nextPath.startsWith("/app") && !nextPath.startsWith("/share/")) return;
      event.preventDefault();
      window.history.pushState({}, "", `${url.pathname}${url.hash}`);
      setPath(nextPath);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  function navigate(nextPath: string) {
    window.history.pushState({}, "", publicHref(nextPath));
    setPath(nextPath);
    window.scrollTo({ top: 0 });
  }

  return { path, navigate };
}
