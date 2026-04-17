import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Tier = "All" | "Full Femme" | "Partial" | "Day-Of";

const filters: Tier[] = ["All", "Full Femme", "Partial", "Day-Of"];

const weddings = [
  {
    image: "/photos/pt.jpg",
    couple: "Priscila & Tri",
    location: "Atlanta, GA",
    tier: "Full Femme" as Tier,
    detail: "Full Coordination + Design",
  },
  {
    image: "/photos/pt2.jpg",
    couple: "Priscila & Tri",
    location: "Atlanta, GA",
    tier: "Full Femme" as Tier,
    detail: "Full Coordination + Design",
  },
  {
    image: "/photos/pt3.jpg",
    couple: "Priscila & Tri",
    location: "Atlanta, GA",
    tier: "Full Femme" as Tier,
    detail: "Full Coordination + Design",
  },
  {
    image: "/photos/kj1.jpg",
    couple: "Kaitlyn & James",
    location: "Roswell, GA",
    tier: "Day-Of" as Tier,
    detail: "Day-of Coordination",
  },
  {
    image: "/photos/kj2.jpg",
    couple: "Kaitlyn & James",
    location: "Roswell, GA",
    tier: "Day-Of" as Tier,
    detail: "Day-of Coordination",
  },
];

export default function Portfolio() {
  const [active, setActive] = useState<Tier>("All");

  const visible = active === "All" ? weddings : weddings.filter((w) => w.tier === active);

  return (
    <section id="portfolio" className="py-24 px-6 md:px-24 bg-femme-cream">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-12"
      >
        <h2 className="text-8xl md:text-9xl text-femme-dark italic mb-4">
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
        className="flex flex-wrap gap-3 mb-12"
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

      {/* Grid */}
      <motion.div layout className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
        <AnimatePresence mode="popLayout">
          {visible.map((wedding, index) => (
            <motion.div
              key={`${wedding.couple}-${wedding.image}`}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.05 }}
              className="group relative overflow-hidden rounded-2xl aspect-[3/4] cursor-pointer"
            >
              <img
                src={wedding.image}
                alt={`${wedding.couple} wedding — ${wedding.detail}`}
                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-femme-dark/80 via-femme-dark/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Tier badge — always visible */}
              <div className="absolute top-4 left-4">
                <span className="bg-femme-plum/90 text-white text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full font-system">
                  {wedding.tier}
                </span>
              </div>

              {/* Caption — slides up on hover */}
              <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <p className="text-white text-2xl font-bold font-balgin">{wedding.couple}</p>
                <p className="text-white/70 text-sm font-system mt-1">{wedding.location} · {wedding.detail}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="text-center py-24 text-femme-dark/40 font-system">
          No weddings in this category yet — check back soon.
        </div>
      )}
    </section>
  );
}
