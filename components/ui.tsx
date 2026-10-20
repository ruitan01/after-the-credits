// Shared primitives so buttons and fields look and behave the same everywhere.

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-amber font-semibold text-night hover:bg-amber-bright",
  quiet: "border border-seam-strong text-ivory hover:border-parchment",
  danger: "border border-ember/70 font-medium text-ember hover:bg-ember/10",
};

const SIZES: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3",
  lg: "px-7 py-3.5 text-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-full transition-colors disabled:cursor-wait disabled:opacity-70 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant, size, className = "", ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export const inputClass =
  "block w-full rounded-lg border border-seam-strong bg-reel px-4 py-3 text-base text-ivory placeholder:text-parchment/70 " +
  "transition-colors hover:border-parchment focus:border-amber focus-visible:outline-amber " +
  "aria-invalid:border-ember";

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="flex items-start gap-2 text-sm font-medium text-ember">
      <span aria-hidden="true" className="mt-px font-bold">
        !
      </span>
      <span>
        <span className="sr-only">Error: </span>
        {message}
      </span>
    </p>
  );
}

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  /** Rendered after the control, beside the error (e.g. a character counter). */
  aside?: ReactNode;
  /** Receives the aria props the control needs to stay linked to its hint and error. */
  children: (control: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
};

export function Field({ id, label, hint, optional, error, aside, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : "", aside ? `${id}-aside` : "", error ? `${id}-error` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-medium text-ivory">
        {label}
        {optional && <span className="font-normal text-parchment"> (optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-parchment">
          {hint}
        </p>
      )}
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {(error || aside) && (
        <div className="flex items-start justify-between gap-4">
          <div>{error && <FieldError id={`${id}-error`} message={error} />}</div>
          {aside && (
            <div id={`${id}-aside`} className="shrink-0">
              {aside}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
