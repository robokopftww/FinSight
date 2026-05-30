import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--color-accent)] px-5 py-3 text-slate-950 hover:bg-[var(--color-accent-strong)]",
        secondary: "border border-white/12 bg-white/5 px-5 py-3 text-white hover:bg-white/10",
        ghost: "px-4 py-2 text-slate-300 hover:bg-white/6 hover:text-white",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant }), className)} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
