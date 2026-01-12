import * as React from "react"
import { cn } from "@/lib/utils"

const Tabs = React.forwardRef(({ className, value, onValueChange, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("w-full", className)} {...props}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { value, onValueChange })
        }
        return child
      })}
    </div>
  )
})
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef(({ className, value: triggerValue, value: contextValue, onValueChange, children, ...props }, ref) => {
  const isActive = triggerValue === contextValue
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive && "bg-white text-slate-900 shadow-sm",
        className
      )}
      onClick={() => onValueChange?.(triggerValue)}
      {...props}
    >
      {children}
    </button>
  )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef(({ className, value: contentValue, value: contextValue, children, ...props }, ref) => {
  if (contentValue !== contextValue) return null
  return (
    <div
      ref={ref}
      className={cn("mt-2 ring-offset-white focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
