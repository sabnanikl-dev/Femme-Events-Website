import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import {
  getInitialTestimonials,
  getTestimonials,
  type Testimonial,
} from "../lib/testimonials";
import { testimonials as fallbackTestimonials } from "../data/testimonials";
import { useCarouselIndex } from "../lib/useCarouselIndex";
import CarouselDots from "./CarouselDots";

function Name({ children }: { children: string }) {
  const parts = children.split("&");
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="font-system">&amp;</span>
          )}
        </span>
      ))}
    </>
  );
}

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(
    () => getInitialTestimonials() ?? fallbackTestimonials,
  );

  useEffect(() => {
    let cancelled = false;
    getTestimonials().then((data) => {
      if (!cancelled && data.length > 0) setTestimonials(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { ref, index, scrollToIndex } = useCarouselIndex<HTMLDivElement>(
    testimonials.length,
  );

  return (
    <section className="py-16 md:py-24 px-6 md:px-24 bg-femme-pale">
      {/* Header row with arrow */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-16 flex items-end justify-between gap-8"
      >
        <div>
          <h2 className="text-6xl md:text-8xl lg:text-9xl text-femme-dark italic mb-4">
            Kind Words
          </h2>
          <div className="h-1 w-32 bg-femme-orange" />
        </div>
      </motion.div>

      {/* Cards + arrow */}
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Mobile: horizontal scroll. Desktop: 3-col grid. */}
        <div
          ref={ref}
          className="flex md:grid md:grid-cols-3 gap-8 flex-1
            overflow-x-auto md:overflow-visible
            snap-x snap-mandatory md:snap-none
            scrollbar-hide
            -mx-6 md:mx-0 px-6 md:px-0
            pb-2 md:pb-0"
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -8 }}
              transition={{
                delay: i * 0.15,
                duration: 0.5,
                type: "spring",
                stiffness: 280,
                damping: 20,
              }}
              className="shrink-0 w-[85vw] md:w-auto snap-start md:snap-align-none
                bg-femme-cream border border-femme-pink/40 p-8 flex flex-col gap-6 rounded-2xl shadow-sm cursor-default"
            >
              {/* Decorative quote mark */}
              <span
                className="text-8xl leading-none text-femme-plum/20 select-none"
                style={{ fontFamily: "Frunchy Sage, serif", fontWeight: "bold" }}
                aria-hidden="true"
              >
                "
              </span>

              {/* Quote */}
              <p className="text-femme-dark/85 text-lg leading-relaxed flex-grow -mt-6">
                {t.quote}
              </p>

              {/* Divider */}
              <div className="h-px bg-femme-pink/40" />

              {/* Attribution */}
              <div className="flex flex-col gap-2 items-center text-center">
                <span className="text-femme-plum text-3xl font-bold font-balgin">
                  <Name>{t.name}</Name>
                </span>
                <span className="text-femme-dark/50 text-sm font-system">
                  {t.detail}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Next arrow — desktop only (mobile uses swipe + dots) */}
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="hidden md:flex shrink-0 w-14 h-14 rounded-full border-2 border-femme-plum text-femme-plum
            items-center justify-center hover:bg-femme-plum hover:text-white
            transition-colors duration-200 cursor-pointer self-auto"
          aria-label="Next testimonials"
        >
          <ArrowRight size={22} strokeWidth={2} />
        </motion.button>
      </div>

      {/* Mobile-only dot indicators */}
      <CarouselDots
        count={testimonials.length}
        activeIndex={index}
        onSelect={scrollToIndex}
        label="Testimonials"
        className="mt-6 md:hidden"
      />
    </section>
  );
}
