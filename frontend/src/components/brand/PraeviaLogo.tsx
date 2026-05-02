import type { CSSProperties } from "react";

type LogoProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
};

export function PraeviaMark({
  size = 32,
  color = "currentColor",
  strokeWidth = 1.4,
  className,
  style,
}: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="12.5" fill="none" stroke={color} strokeWidth={strokeWidth} opacity="0.35" />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <circle cx="13" cy="16" r="2.4" fill="var(--signal-amber)" />
      <line x1="6" y1="4.5" x2="14" y2="4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="square" />
    </svg>
  );
}

type WordmarkProps = {
  size?: number;
  color?: string;
  product?: string;
  compact?: boolean;
};

export function PraeviaWordmark({ size = 22, color = "currentColor" }: WordmarkProps) {
  return (
    <span className="praevia-wordmark" style={{ fontSize: size * 1.55, color }}>
      <span>prae</span>
      <em>vi</em>
      <b>A</b>
    </span>
  );
}

export function PraeviaLockup({
  size = 22,
  color = "currentColor",
  product = "NeuroImpact Analyzer",
  compact = false,
}: WordmarkProps) {
  return (
    <span className={compact ? "praevia-lockup compact" : "praevia-lockup"} style={{ color }}>
      <span className="praevia-lockup-row">
        <PraeviaMark size={size * 1.25} color={color} />
        <PraeviaWordmark size={size} color={color} />
      </span>
      {product ? <span className="praevia-product-name">{product}</span> : null}
    </span>
  );
}

