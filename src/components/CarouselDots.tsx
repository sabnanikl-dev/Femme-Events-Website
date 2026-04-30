interface CarouselDotsProps {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  label: string;
  className?: string;
}

export default function CarouselDots({
  count,
  activeIndex,
  onSelect,
  label,
  className = "",
}: CarouselDotsProps) {
  if (count <= 1) return null;
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex items-center justify-center gap-2.5 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => onSelect(i)}
            className={`h-2 rounded-full transition-all duration-200 ${
              active
                ? "w-6 bg-femme-orange"
                : "w-2 bg-femme-plum/30 hover:bg-femme-plum/60"
            }`}
          />
        );
      })}
    </div>
  );
}
