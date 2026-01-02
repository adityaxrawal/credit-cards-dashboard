import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/shared/utils"

const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <div className="relative flex items-center">
    <input
      type="checkbox"
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none checked:bg-primary-green checked:border-primary-green transition-colors cursor-pointer",
        className
      )}
      ref={ref}
      {...props}
    />
    <Check className="h-3 w-3 text-white absolute top-0.5 left-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
  </div>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }
