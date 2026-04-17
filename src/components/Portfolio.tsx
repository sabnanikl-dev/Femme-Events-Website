import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";

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

const CARD_WIDTH = 380;
const CARD_GAP = 20;
const CARD_STRIDE = CARD_WIDTH + CARD_GAP;

function Carousel({ items }: { items: typeof weddings }) {
  const [current, setCurrent] = useState(0);
  const x = useMotionValue(0);
  const dragStartX = useRef(0);

  const count = items.length;

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(index, count - 1));
    setCurrent(clamped);
    animate(x, -clamped * CARD_STRIDE, { type: "spring", stiffness: 300, damping: 35 });
  }

  function onDragStart() {
    dragStartX.current = x.get();
  }

  function onDragEnd(_: unknown, info: { offset: { x: number } }) {
    const delta = info.offset.x;
    if (delta < -40) goTo(current + 1);
    else if (delta > 40) goTo(current - 1);
    else goTo(current);
  }

  // Scale down cards that are not current
  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="flex gap-5 cursor-grab active:cursor-grabbing"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -(count - 1) * CARD_STRIDE, right: 0 }}
        dragElastic={0.1}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {items.map((wedding, index) => {
          const distance = useTransform(x, (val) => {
            const cardCenter = index * CARD_STRIDE + CARD_WIDTH / 2;
            const viewCenter = -val + CARD_WIDTH / 2;
            return Math.abs(cardCenter - viewCenter);
          });
          const scale = useTransform(distance, [0, CARD_STRIDE], [1, 0.9]);
          const opacity = useTransform(distance, [0, CARD_STRIDE * 1.5], [1, 0.5]);

          return (
            <motion.div
              key={`${wedding.couple}-${wedding.image}`}
              style={{ scale, opacity, width: CARD_WIDTH, flexShrink: 0 }}
              className="group relative overflow-hidden rounded-2xl aspect-[3/4] cursor-pointer"
              onClick={() => goTo(index)}
            >
              <img
                src={wedding.image}
                alt={`${wedding.couple} wedding — ${wedding.detail}`}
                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105 pointer-events-none select-none"
                draggable={false}
              />

              {/* Always-on gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-femme-dark/80 via-femme-dark/10 to-transparent" />

              {/* Tier badge */}
              <div className="absolute top-4 left-4">
                <span className="bg-femme-plum/90 text-white text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full font-system">
                  {wedding.tier}
                </span>
              </div>

              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-white text-2xl font-bold font-balgin">{wedding.couple}</p>
                <p className="text-white/70 text-sm font-system mt-1">{wedding.location} · {wedding.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Dot indicators */}
      <div className="flex gap-2 mt-8 justify-center">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              i === current
                ? "w-8 h-2 bg-femme-plum"
                : "w-2 h-2 bg-femme-plum/30 hover:bg-femme-plum/60"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Portfolio() {
  const [active, setActive] = useState<Tier>("All");

  const visible = active === "All" ? weddings : weddings.filter((w) => w.tier === active);

  return (
    <section id="portfolio" className="py-24 bg-femme-cream overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-12 px-6 md:px-24"
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
        className="flex flex-wrap gap-3 mb-10 px-6 md:px-24"
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

      {/* Carousel — bleeds past padding for edge-to-edge feel */}
      <div className="pl-6 md:pl-24">
        <AnimatePresence mode="wait">
          {visible.length > 0 ? (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Carousel items={visible} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-24 text-femme-dark/40 font-system"
            >
              No weddings in this category yet — check back soon.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
