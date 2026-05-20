import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FramerCarousel } from "@/components/ui/framer-carousel";
import type { CarouselItem } from "@/components/ui/framer-carousel";

type Tier = "All" | "Full Femme" | "Partial" | "Day-Of";

const filters: Tier[] = ["All", "Full Femme", "Partial", "Day-Of"];

const weddings: (CarouselItem & { tier: Tier })[] = [
  {
    id: 1,
    url: "/photos/amanda-2026/amanda-wedding-01.jpg",
    couple: "Real Femme Wedding",
    location: "Atlanta, GA",
    tier: "Full Femme",
    detail: "Planning details + wedding-day support",
  },
  {
    id: 2,
    url: "/photos/amanda-2026/amanda-wedding-02.jpg",
    couple: "Real Femme Wedding",
    location: "Atlanta, GA",
    tier: "Full Femme",
    detail: "Ceremony and reception coordination",
  },
  {
    id: 3,
    url: "/photos/amanda-2026/amanda-wedding-03.jpg",
    couple: "Real Femme Wedding",
    location: "Atlanta, GA",
    tier: "Partial",
    detail: "Timeline, vendor alignment, and details",
  },
  {
    id: 4,
    url: "/photos/amanda-2026/amanda-wedding-04.jpg",
    couple: "Real Femme Wedding",
    location: "Atlanta, GA",
    tier: "Day-Of",
    detail: "Wedding-day management",
  },
  {
    id: 5,
    url: "/photos/amanda-2026/amanda-wedding-05.jpg",
    couple: "Real Femme Wedding",
    location: "Atlanta, GA",
    tier: "Day-Of",
    detail: "End-to-end celebration support",
  },
];

export default function Portfolio() {
  const [active, setActive] = useState<Tier>("All");

  const visible = active === "All" ? weddings : weddings.filter((w) => w.tier === active);

  return (
    <section id="portfolio" className="py-16 md:py-24 px-6 md:px-24 bg-femme-pale/60">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-12"
      >
        <h2 className="text-6xl md:text-8xl lg:text-9xl text-femme-dark italic mb-4">
          Real Weddings
        </h2>
        <div className="h-1 w-32 bg-femme-orange" />
        <p className="mt-6 text-femme-dark/60 text-xl font-system max-w-2xl">
          A few moments from Amanda’s latest wedding gallery — proof that calm logistics and pretty details can absolutely coexist.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="flex flex-wrap gap-3 mb-10"
      >
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActive(filter)}
            className={`px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest font-system transition-colors duration-200 cursor-pointer border ${
              active === filter
                ? "bg-femme-plum text-white border-femme-plum"
                : "bg-transparent text-femme-dark/60 border-femme-dark/20 hover:border-femme-plum hover:text-femme-plum"
            }`}
          >
            {filter}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <FramerCarousel items={visible} />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
