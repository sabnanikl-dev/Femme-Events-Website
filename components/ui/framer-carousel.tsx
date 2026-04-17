import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CarouselItem {
  id: number;
  url: string;
  couple: string;
  location: string;
  tier: string;
  detail: string;
}

interface FramerCarouselProps {
  items: CarouselItem[];
}

export function FramerCarousel({ items }: FramerCarouselProps) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  // Reset to first slide when items change (filter switch)
  useEffect(() => {
    setIndex(0);
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
  }, [items, x]);

  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth || 1;
      animate(x, -index * containerWidth, {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      });
    }
  }, [index, x]);

  if (items.length === 0) {
    return (
      <div className="py-24 text-center text-femme-dark/40 font-system">
        No weddings in this category yet — check back soon.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-2xl" ref={containerRef}>
        <motion.div className="flex" style={{ x }}>
          {items.map((item) => (
            <div key={item.id} className="shrink-0 w-full h-[750px] relative">
              <img
                src={item.url}
                alt={`${item.couple} — ${item.detail}`}
                className="w-full h-full object-cover rounded-2xl select-none pointer-events-none"
                draggable={false}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-femme-dark/75 via-femme-dark/10 to-transparent rounded-2xl" />

              {/* Tier badge */}
              <div className="absolute top-5 left-5">
                <span className="bg-femme-plum/90 text-white text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full font-system">
                  {item.tier}
                </span>
              </div>

              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <p className="text-white text-3xl font-bold font-balgin">{item.couple}</p>
                <p className="text-white/70 text-sm font-system mt-1">{item.location} · {item.detail}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Prev button */}
        <motion.button
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          whileHover={index !== 0 ? { scale: 1.1 } : {}}
          whileTap={index !== 0 ? { scale: 0.95 } : {}}
          className={`absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center shadow-lg z-10 transition-colors duration-200 ${
            index === 0
              ? 'bg-white/20 text-white/40 cursor-not-allowed'
              : 'bg-femme-cream text-femme-dark hover:bg-femme-plum hover:text-white cursor-pointer'
          }`}
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </motion.button>

        {/* Next button */}
        <motion.button
          disabled={index === items.length - 1}
          onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
          whileHover={index !== items.length - 1 ? { scale: 1.1 } : {}}
          whileTap={index !== items.length - 1 ? { scale: 0.95 } : {}}
          className={`absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center shadow-lg z-10 transition-colors duration-200 ${
            index === items.length - 1
              ? 'bg-white/20 text-white/40 cursor-not-allowed'
              : 'bg-femme-cream text-femme-dark hover:bg-femme-plum hover:text-white cursor-pointer'
          }`}
        >
          <ChevronRight size={20} strokeWidth={2} />
        </motion.button>

        {/* Dot progress */}
        <div className="absolute bottom-5 right-8 flex gap-2 p-2 bg-femme-dark/30 backdrop-blur-sm rounded-xl border border-white/10">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                i === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
