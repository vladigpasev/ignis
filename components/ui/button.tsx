"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "outline"
  size?: "sm" | "md" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size = "md", ...props },
    ref
  ) => {
    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      default:
        "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 border",
      ghost: "hover:bg-muted",
      outline: "border bg-transparent hover:bg-muted",
    }

    const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "h-9 px-3 text-sm",
      md: "h-10 px-4",
      lg: "h-11 px-6 text-base",
      icon: "h-10 w-10",
    }

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
