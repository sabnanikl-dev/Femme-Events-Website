import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ButtonCtaProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
  className?: string
}

function ButtonCta({ label = "Book a Consultation", className, ...props }: ButtonCtaProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "group relative h-14 px-10 rounded-full overflow-hidden transition-all duration-500 cursor-pointer",
        className
      )}
      {...props}
    >
      {/* Outer border gradient — plum → dark → plum */}
      <div className="absolute inset-0 rounded-full p-[2px] bg-gradient-to-b from-[#bd708c] via-[#3f0d2a] to-[#7f165b]">
        <div className="absolute inset-0 bg-[#3f0d2a] rounded-full opacity-90" />
      </div>

      {/* Inner fill layers */}
      <div className="absolute inset-[2px] bg-[#3f0d2a] rounded-full opacity-95" />
      <div className="absolute inset-[2px] bg-gradient-to-r from-[#3f0d2a] via-[#5a1140] to-[#3f0d2a] rounded-full opacity-90" />
      <div className="absolute inset-[2px] bg-gradient-to-b from-[#bd708c]/40 via-[#5a1140] to-[#7f165b]/30 rounded-full opacity-80" />
      <div className="absolute inset-[2px] bg-gradient-to-br from-[#ddadbc]/10 via-[#5a1140] to-[#3f0d2a]/50 rounded-full" />

      {/* Inner glow */}
      <div className="absolute inset-[2px] shadow-[inset_0_0_15px_rgba(189,112,140,0.2)] rounded-full" />

      {/* Label */}
      <div className="relative flex items-center justify-center gap-2">
        <span className="text-base font-bold bg-gradient-to-b from-[#ddadbc] to-[#bd708c] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(189,112,140,0.5)] tracking-widest uppercase font-system">
          {label}
        </span>
      </div>

      {/* Hover shimmer */}
      <div className="absolute inset-[2px] opacity-0 transition-opacity duration-300 bg-gradient-to-r from-[#7f165b]/20 via-[#ddadbc]/10 to-[#7f165b]/20 group-hover:opacity-100 rounded-full" />
    </Button>
  )
}

export { ButtonCta }
