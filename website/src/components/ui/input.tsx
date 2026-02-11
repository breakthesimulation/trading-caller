import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-9 w-full rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 text-sm text-text-primary shadow-sm transition-colors",
      "placeholder:text-text-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/50 focus-visible:border-brand-purple",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
