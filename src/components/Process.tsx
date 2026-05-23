import { motion } from "motion/react";
import CarouselDots from "./CarouselDots";
import { useCarouselIndex } from "../lib/useCarouselIndex";
import { trackEvent } from "../lib/analytics";
import SafeText from "./SafeText";

const steps = [
  {
    number: "01",
    label: "Inquire",
    description:
      "Fill out the inquiry form and we'll get back to you within 48 hours to schedule a free consultation call.",
  },
  {
    number: "02",
    label: "Get Organized",
    description:
      "We gather the vendor contracts, contact information, priorities, timelines, and moving pieces so nothing important is floating around in a group chat.",
  },
  {
    number: "03",
    label: "Shape the Look",
    description:
      "Mood boards, color palettes, floral notes, linens, stationery guidance, and decor direction help the aesthetic feel cohesive without forcing it into a template.",
  },
  {
    number: "04",
    label: "Celebrate",
    description:
      "You guide the energy. We run the timeline, vendors, setup, rehearsal, and wedding-day logistics so you can be fully present with your people.",
  },
];

export default function Process() {
  const { ref, index, scrollToIndex } = useCarouselIndex<HTMLDivElement>(
    steps.length,
  );

  return (
    <section className="py-16 md:py-24 px-6 md:px-24 bg-femme-cream overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-20"
      >
        <h2 className="text-6xl md:text-8xl lg:text-9xl text-femme-dark italic mb-4">
          What Happens Next
        </h2>
        <div className="h-1 w-32 bg-femme-orange" />
        <p className="mt-6 text-femme-dark/60 text-xl font-system max-w-xl">
          From the moment you reach out to the last dance, here's how we make it happen.
        </p>
      </motion.div>

      {/* Steps */}
      <div className="relative">
        {/* Connecting line — desktop only */}
        <div className="hidden md:block absolute top-10 left-0 right-0 h-px bg-femme-plum/15 z-0" />

        {/* Mobile: horizontal snap-scroll, one step + a peek of the next.
            Desktop (md+): unchanged 4-column grid. The negative margin lets
            cards reach the screen edge while the section keeps its padding. */}
        <div
          ref={ref}
          className="flex md:grid md:grid-cols-4 gap-6
            overflow-x-auto md:overflow-visible
            snap-x snap-mandatory md:snap-none
            scrollbar-hide
            -mx-6 md:mx-0 px-6 md:px-0
            pb-2 md:pb-0
            relative z-10"
        >
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.6, ease: "easeOut" }}
              className="flex flex-col gap-5 shrink-0 w-[85vw] md:w-auto snap-start md:snap-align-none"
            >
              {/* Number badge */}
              <div className="w-20 h-20 rounded-full border-2 border-femme-plum flex items-center justify-center shrink-0 bg-femme-cream">
                <span className="text-femme-plum text-2xl font-bold font-system">
                  {step.number}
                </span>
              </div>

              {/* Label */}
              <h3
                className="text-5xl text-femme-dark"
                style={{ fontFamily: "Frunchy Sage, serif", fontWeight: "bold" }}
              >
                <SafeText text={step.label} />
              </h3>

              {/* Description */}
              <p className="text-femme-dark/65 text-base leading-relaxed font-system">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Mobile-only step indicators */}
      <CarouselDots
        count={steps.length}
        activeIndex={index}
        onSelect={scrollToIndex}
        label="Planning steps"
        className="mt-6 md:hidden"
      />

      {/* Bottom CTA nudge */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        className="mt-16 md:mt-20 flex flex-col md:flex-row md:items-center gap-4 md:gap-6"
      >
        <a
          href="#inquiry-form"
          onClick={() => trackEvent("cta_inquiry_click", { location: "process" })}
          className="inline-block bg-femme-plum text-white px-10 py-4 rounded-full font-bold text-sm uppercase tracking-widest shadow-md hover:bg-femme-dark transition-colors duration-200 font-system"
        >
          Start Your Journey
        </a>
        <a
          href="/what-happens-next"
          className="text-femme-plum text-sm font-system uppercase tracking-widest font-bold hover:text-femme-dark transition-colors duration-200"
        >
          Already booked? See the full planning flow
        </a>
        <span className="text-femme-dark/40 text-sm font-system uppercase tracking-widest">
          Free consultation · No commitment
        </span>
      </motion.div>
    </section>
  );
}
