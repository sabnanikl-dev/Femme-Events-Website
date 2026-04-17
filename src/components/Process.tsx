import { motion } from "motion/react";

const steps = [
  {
    number: "01",
    label: "Book",
    description:
      "Fill out the inquiry form and we'll get back to you within 48 hours to schedule a free consultation call.",
  },
  {
    number: "02",
    label: "Plan",
    description:
      "We map out your vision — vendors, timelines, budgets, and everything in between. You make decisions; we handle the logistics.",
  },
  {
    number: "03",
    label: "Design",
    description:
      "Mood boards, color palettes, decor direction — we build the aesthetic so your day looks exactly how you dreamed it.",
  },
  {
    number: "04",
    label: "Celebrate",
    description:
      "Show up, breathe, and soak it all in. We're running the show behind the scenes so you never have to.",
  },
];

export default function Process() {
  return (
    <section className="py-24 px-6 md:px-24 bg-femme-cream overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-20"
      >
        <h2 className="text-8xl md:text-9xl text-femme-dark italic mb-4">
          What Happens Next
        </h2>
        <div className="h-1 w-32 bg-femme-orange" />
        <p className="mt-6 text-femme-dark/60 text-xl font-system max-w-xl">
          From the moment you reach out to the last dance — here's how we make it happen.
        </p>
      </motion.div>

      {/* Steps */}
      <div className="relative">
        {/* Connecting line — desktop only */}
        <div className="hidden md:block absolute top-10 left-0 right-0 h-px bg-femme-plum/15 z-0" />

        <div className="grid md:grid-cols-4 gap-10 md:gap-6 relative z-10">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.6, ease: "easeOut" }}
              className="flex flex-col gap-5"
            >
              {/* Number badge */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full border-2 border-femme-plum flex items-center justify-center shrink-0 bg-femme-cream">
                  <span
                    className="text-femme-plum text-2xl font-bold font-system"
                  >
                    {step.number}
                  </span>
                </div>
                {/* Mobile connector line */}
                <div className="md:hidden flex-1 h-px bg-femme-plum/15" />
              </div>

              {/* Label */}
              <h3
                className="text-5xl text-femme-dark"
                style={{ fontFamily: "Frunchy Sage, serif", fontWeight: "bold" }}
              >
                {step.label}
              </h3>

              {/* Description */}
              <p className="text-femme-dark/65 text-base leading-relaxed font-system">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom CTA nudge */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        className="mt-20 flex items-center gap-6"
      >
        <a
          href="#inquiry"
          className="inline-block bg-femme-plum text-white px-10 py-4 rounded-full font-bold text-sm uppercase tracking-widest shadow-md hover:bg-femme-dark transition-colors duration-200 font-system"
        >
          Start Your Journey
        </a>
        <span className="text-femme-dark/40 text-sm font-system uppercase tracking-widest">
          Free consultation · No commitment
        </span>
      </motion.div>
    </section>
  );
}
