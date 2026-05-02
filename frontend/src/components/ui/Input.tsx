import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  help?: ReactNode;
  error?: ReactNode;
};

export function Input({ label, help, error, id, ...props }: InputProps) {
  const inputId = id ?? label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return (
    <label className={error ? "field field-error" : "field"} htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <input id={inputId} className="input" {...props} />
      {error ? <span className="field-message error">{error}</span> : null}
      {!error && help ? <span className="field-message">{help}</span> : null}
    </label>
  );
}
