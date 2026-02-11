import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand-purple/20 text-brand-purple-light",
        long: "bg-long-green-dim text-long-green",
        short: "bg-short-red-dim text-short-red",
        cyan: "bg-brand-cyan/20 text-brand-cyan",
        muted: "bg-bg-elevated text-text-secondary",
        warning: "bg-yellow-500/20 text-yellow-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
