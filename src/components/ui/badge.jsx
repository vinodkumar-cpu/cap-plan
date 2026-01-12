import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-slate-900 text-white",
        secondary: "border-transparent bg-slate-100 text-slate-700",
        destructive: "border-transparent bg-red-100 text-red-700",
        outline: "text-slate-700 border-slate-200",
        success: "border-transparent",
        warning: "border-transparent bg-amber-100 text-amber-700",
        info: "border-transparent bg-blue-100 text-blue-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  const successStyle = variant === 'success' ? { backgroundColor: '#e8f5e0', color: '#163300' } : undefined
  return <div className={cn(badgeVariants({ variant }), className)} style={successStyle} {...props} />
}

export { Badge, badgeVariants }
