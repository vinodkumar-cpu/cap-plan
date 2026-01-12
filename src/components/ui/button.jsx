import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white shadow hover:bg-slate-800 focus-visible:ring-slate-900",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600",
        outline: "border border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-400",
        secondary: "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200 focus-visible:ring-slate-400",
        ghost: "hover:bg-slate-100 hover:text-slate-900",
        link: "text-slate-900 underline-offset-4 hover:underline",
        success: "bg-emerald-600 text-white shadow hover:bg-emerald-700 focus-visible:ring-emerald-600",
        warning: "bg-amber-500 text-white shadow hover:bg-amber-600 focus-visible:ring-amber-500",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
