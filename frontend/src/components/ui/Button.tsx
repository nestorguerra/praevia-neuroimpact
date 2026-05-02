import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { publicHref } from "../../routing/paths";

type ButtonBaseProps = {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  children: ReactNode;
};

type ButtonProps = ButtonBaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", size = "md", icon, children, className = "", ...props }: ButtonProps) {
  return (
    <button className={`ui-button ui-button-${variant} ui-button-${size} ${className}`} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

type LinkButtonProps = ButtonBaseProps & AnchorHTMLAttributes<HTMLAnchorElement>;

export function LinkButton({ variant = "primary", size = "md", icon, children, className = "", ...props }: LinkButtonProps) {
  const href = publicHref(props.href);
  return (
    <a className={`ui-button ui-button-${variant} ui-button-${size} ${className}`} {...props} href={href}>
      {icon}
      <span>{children}</span>
    </a>
  );
}
