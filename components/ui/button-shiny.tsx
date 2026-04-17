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
      <div className="absolute inset-0 rounded-full p-[2px] bg-gradient-to-b from-femme-sage via-femme-dark to-femme-plum">
        <div className="absolute inset-0 bg-femme-dark rounded-full opacity-90" />
      </div>

      {/* Inner fill layers */}
      <div className="absolute inset-[2px] bg-femme-dark rounded-full opacity-95" />
      <div className="absolute inset-[2px] bg-gradient-to-r from-femme-dark via-femme-plum to-femme-dark rounded-full opacity-90" />
      <div className="absolute inset-[2px] bg-gradient-to-b from-femme-sage/40 via-femme-plum to-femme-plum/30 rounded-full opacity-80" />
      <div className="absolute inset-[2px] bg-gradient-to-br from-femme-pink/10 via-femme-plum to-femme-dark/50 rounded-full" />

      {/* Inner glow */}
      <div className="absolute inset-[2px] shadow-[inset_0_0_15px_rgba(197,109,153,0.2)] rounded-full" />

      {/* Label */}
      <div className="relative flex items-center justify-center gap-2">
        <span className="text-base font-bold bg-gradient-to-b from-femme-pink to-femme-sage bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(197,109,153,0.5)] tracking-widest uppercase font-system">
          {label}
        </span>
      </div>

      {/* Hover shimmer */}
      <div className="absolute inset-[2px] opacity-0 transition-opacity duration-300 bg-gradient-to-r from-femme-plum/20 via-femme-pink/10 to-femme-plum/20 group-hover:opacity-100 rounded-full" />
    </Button>
  )
}

export { ButtonCta }
