import type { ReactNode } from "react";

type CardProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  className?: string;
};

export function Card({ eyebrow, title, children, className = "" }: CardProps) {
  return (
    <article className={`card ${className}`}>
      {eyebrow ? <div className="card-eyebrow">{eyebrow}</div> : null}
      <h3>{title}</h3>
      <div className="card-body">{children}</div>
    </article>
  );
}

