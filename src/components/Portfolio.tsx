import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FramerCarousel } from "@/components/ui/framer-carousel";
import type { CarouselItem } from "@/components/ui/framer-carousel";

type Tier = "All" | "Full Femme" | "Partial" | "Day-Of";

const filters: Tier[] = ["All", "Full Femme", "Partial", "Day-Of"];

const weddings: (CarouselItem & { tier: Tier })[] = [
  {
    id: 1,
    url: "/photos/pt.jpg",
    couple: "Priscila & Tri",
    location: "Atlanta, GA",
    tier: "Full Femme",
    detail: "Full Coordination + Design",
  },
  {
    id: 2,
    url: "/photos/pt2.jpg",
    couple: "Priscila & Tri",
    location: "Atlanta, GA",
    tier: "Full Femme",
    detail: "Full Coordination + Design",
  },
  {
    id: 3,
    url: "/photos/pt3.jpg",
    couple: "Priscila & Tri",
    location: "Atlanta, GA",
    tier: "Full Femme",
    detail: "Full Coordination + Design",
  },
  {
    id: 4,
    url: "/photos/kj1.jpg",
    couple: "Kaitlyn & James",
    location: "Roswell, GA",
    tier: "Day-Of",
    detail: "Day-of Coordination",
  },
  {
    id: 5,
    url: "/photos/kj2.jpg",
    couple: "Kaitlyn & James",
    location: "Roswell, GA",
    tier: "Day-Of",
    detail: "Day-of Coordination",
  },
];

export default function Portfolio() {
  const [active, setActive] = useState<Tier>("All");

  const visible = active === "All" ? weddings : weddings.filter((w) => w.tier === active);

  return (
    <section id="portfolio" className="py-16 md:py-24 px-6 md:px-24 bg-femme-cream">
      {/* Header */}
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
        <p className="mt-6 text-femme-dark/60 text-xl font-system max-w-xl">
          Every wedding is different. Here's proof.
        </p>
      </motion.div>

      {/* Filter pills */}
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

      {/* Carousel */}
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
