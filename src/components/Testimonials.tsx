import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

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

const testimonials = [
  {
    quote:
      "Amanda made our day feel effortless. Every tiny detail we obsessed over for months just appeared — perfectly. We didn't lift a finger and somehow it was better than anything we'd imagined.",
    name: "Priscila & Tri",
    detail: "Atlanta, GA · Full Coordination + Design",
  },
  {
    quote:
      "Hiring Femme Events for day-of coordination was the best decision we made. Amanda kept everything moving without us ever feeling the pressure. Our guests still talk about how smooth it all was.",
    name: "Kaitlyn & James",
    detail: "Roswell, GA · Day-of Coordination",
  },
  {
    quote:
      "We were DIY-ing everything and totally overwhelmed. The partial planning package was exactly what we needed — vendor recommendations, mood boards, budget help. She got us across the finish line with our sanity intact.",
    name: "Maya & Devon",
    detail: "Decatur, GA · Partial Planning",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 px-6 md:px-24 bg-femme-pale">
      {/* Header row with arrow */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-16 flex items-end justify-between gap-8"
      >
        <div>
          <h2 className="text-8xl md:text-9xl text-femme-dark italic mb-4">
            Kind Words
          </h2>
          <div className="h-1 w-32 bg-femme-orange" />
        </div>
      </motion.div>

      {/* Cards + arrow */}
      <div className="flex items-center gap-6">
        <div className="grid md:grid-cols-3 gap-8 flex-1">
        {testimonials.map((t, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -8 }}
            transition={{ delay: index * 0.15, duration: 0.5, type: "spring", stiffness: 280, damping: 20 }}
            className="bg-femme-cream border border-femme-pink/40 p-8 flex flex-col gap-6 rounded-2xl shadow-sm cursor-default"
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

        {/* Next arrow — centered with cards, after the last one */}
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="shrink-0 w-14 h-14 rounded-full border-2 border-femme-plum text-femme-plum
            flex items-center justify-center hover:bg-femme-plum hover:text-white
            transition-colors duration-200 cursor-pointer"
          aria-label="Next testimonials"
        >
          <ArrowRight size={22} strokeWidth={2} />
        </motion.button>
      </div>
    </section>
  );
}
