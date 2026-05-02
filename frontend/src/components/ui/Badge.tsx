import type { ReactNode } from "react";

export type BadgeTone = "amber" | "cyan" | "lime" | "coral" | "violet" | "muted";

type BadgeProps = {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
};

export function Badge({ tone = "muted", dot = false, children }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  );
}

