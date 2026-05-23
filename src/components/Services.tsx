import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import CarouselDots from "./CarouselDots";
import { useCarouselIndex } from "../lib/useCarouselIndex";
import { trackEvent } from "../lib/analytics";
import SafeText from "./SafeText";
import { inquiryHrefForLabel } from "../data/serviceOptions";

const services = [
  {
    title: "In Your Corner",
    subtitle: "Wedding Coordination",
    image: "/photos/pt3.jpg",
    alt: "Couple sharing a moment by arched window",
    includes: [
      "Services begin six weeks before the wedding day",
      "Initial consultation + venue walkthrough",
      "Vendor coordination: contracts, timelines, and contact information",
      "Detailed wedding timeline",
      "All-day wedding management",
      "Rehearsal coordination",
      "Items pickup and venue breakdown oversight",
    ],
    note: null,
  },
  {
    title: "Getting It Together",
    subtitle: "Partial Planning + Coordination",
    image: "/photos/kj1.jpg",
    alt: "Couple sharing a kiss in the car after their ceremony",
    includes: [
      "Services begin 12 weeks before the wedding day",
      "Everything in Wedding Coordination, plus:",
      "3-4 planning sessions, virtual or in-person",
      "Vendor recommendations",
      "Vendor meeting attendance, up to 3 meetings",
      "Decor coordination: what to source, where it goes, and how it gets set up",
    ],
    note: null,
  },
  {
    title: "The Full Femme",
    subtitle: "Full Coordination + Design Guidance",
    image: "/photos/kj2.jpg",
    alt: "Couple celebrating their grand exit through a confetti send-off",
    includes: [
      "Services begin six months before the wedding day",
      "Everything in Partial Planning + Coordination, plus:",
      "Full design direction for the wedding's overall mood, palette, and visual story",
      "Pinterest and mood board refinement so the inspiration turns into a cohesive design plan",
      "Floral direction, linen selection, stationery guidance, decor notes, and styling details",
      "DIY decor sourcing + creation coordination",
      "Unlimited planning support by call and email",
      "High-touch coordination so the wedding feels intentional, personal, and visually pulled together",
    ],
    note: null,
  },
];

const addons = [
  "Rehearsal dinner coordination",
  "Welcome party coordination",
  "Decor package (setup + breakdown only)",
  "Destination wedding premium (30+ miles)",
];

function IncludesList({
  service,
  compact = false,
}: {
  service: (typeof services)[0];
  compact?: boolean;
}) {
  return (
    <ul className={`flex flex-col ${compact ? "gap-1.5 mb-5" : "gap-2 mb-6"}`}>
      {service.includes.map((item, i) => (
        <li key={i} className={compact ? "flex gap-2 items-start" : "flex gap-2.5 items-start"}>
          <span className="w-1.5 h-1.5 rounded-full bg-femme-pink shrink-0 mt-[6px]" />
          <span className={`text-white/90 leading-snug font-system ${compact ? "text-[0.8125rem]" : "text-sm"}`}>
            {item}
          </span>
        </li>
      ))}
      {service.note && (
        <li className="text-white/50 text-xs italic pl-4 font-system mt-1">
          {service.note}
        </li>
      )}
    </ul>
  );
}

function ServiceCard({
  service,
  index,
}: {
  service: (typeof services)[0];
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();
  const isFullFemme = service.title === "The Full Femme";

  // Carries the clicked package to the inquiry form via the URL, e.g.
  // `/?service=the-full-femme#inquiry-form`, so the form can prefill it.
  const inquiryHref = inquiryHrefForLabel(service.title);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15, duration: 0.6, ease: "easeOut" }}
      className={`relative shrink-0 w-[85vw] md:w-auto ${isFullFemme ? "h-[760px]" : "h-[640px]"} md:h-[700px] snap-center md:snap-align-none rounded-2xl overflow-hidden cursor-pointer shadow-xl`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Full-bleed photo */}
      <motion.img
        src={service.image}
        alt={service.alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover object-center"
        animate={{ scale: hovered ? 1.06 : 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* Base gradient — always visible at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-femme-dark/90 via-femme-dark/30 to-transparent" />

      {/* Hover overlay — desktop only, deepens the gradient */}
      <motion.div
        className="absolute inset-0 bg-femme-dark/40 hidden md:block"
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />

      {/* Mobile static overlay so the always-visible includes stay legible */}
      <div className="absolute inset-0 bg-femme-dark/30 md:hidden" />

      {/* Card content */}
      <div className="absolute inset-0 flex flex-col justify-end p-8">
        {/* Mobile: includes always visible — no hover state on touch */}
        <div className="md:hidden">
          <IncludesList service={service} compact={isFullFemme} />
        </div>

        {/* Desktop: includes slide up on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              key="includes"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="hidden md:block"
            >
              <IncludesList service={service} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Title block — always visible */}
        <div className="mb-5">
          <h3
            className="text-white text-5xl md:text-6xl leading-tight mb-2"
            style={{ fontFamily: "Frunchy Sage, serif", fontWeight: "bold" }}
          >
            <SafeText text={service.title} />
          </h3>
          <p className="text-femme-pink text-sm uppercase tracking-[0.25em] font-bold font-system">
            {service.subtitle}
          </p>
        </div>

        {/* Book Now button — carries the selected package to the inquiry form.
            The real href keeps no-JS fallback and modified-click (open in new
            tab/window) working; a plain left-click does a client-side navigation
            instead so visitors don't pay for a full reload. */}
        <motion.a
          href={inquiryHref}
          onClick={(e) => {
            // Let the browser handle modified clicks via the real href so
            // Cmd/Ctrl/Shift-click still opens the form in a new tab/window.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            trackEvent("cta_inquiry_click", { location: "service_card", service: service.title });
            navigate(inquiryHref);
            // Scroll explicitly: switching packages while already at the form
            // anchor is a search-only URL change, so ScrollToHash (keyed on
            // pathname/hash) won't re-fire. The dedicated form anchor keeps
            // visitors from landing in the FAQ/introduction area.
            document.getElementById("inquiry-form")?.scrollIntoView({ block: "start" });
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          aria-label={`Book ${service.title} — jump to inquiry form`}
          className="block w-full py-3.5 text-sm font-bold uppercase tracking-widest font-system text-center
            bg-transparent border-2 border-white/70 text-white
            hover:bg-femme-plum hover:border-femme-plum
            transition-colors duration-200 cursor-pointer rounded-sm no-underline"
        >
          Book Now
        </motion.a>
      </div>
    </motion.div>
  );
}

export default function Services() {
  const { ref, index, scrollToIndex } = useCarouselIndex<HTMLDivElement>(
    services.length,
  );

  return (
    <section id="services" className="py-16 md:py-24 px-6 md:px-24 bg-femme-lavender">
      {/* Header */}
      <div className="mb-16">
        <h2 className="text-5xl md:text-8xl text-femme-dark leading-tight italic mb-6">
          <SafeText text="For the look, the feeling, and every moving piece in between." />
        </h2>
        <div className="h-1 w-32 bg-femme-orange mb-8" />
        <div className="max-w-3xl">
          <p className="text-femme-dark/70 text-base md:text-lg font-system leading-relaxed mb-4">
            Femme Events is for couples who know what they want the wedding to
            feel like, even if they need help turning the Pinterest boards,
            vendor emails, family opinions, and tiny moving pieces into an actual
            plan.
          </p>
          <p className="text-femme-dark/70 text-base md:text-lg font-system leading-relaxed">
            We do not believe in “this is how it’s always done.” We believe in
            your way, your energy, your people, and a planning process that feels
            safe, clear, and completely supported.
          </p>
        </div>
      </div>

      {/* Service Cards: horizontal scroll on mobile, grid on desktop.
          The negative margin lets cards flow to the screen edge; the
          symmetric 7.5vw inset (= (100vw - 85vw card)/2) keeps the
          snap-centered card balanced in the viewport on mobile. Desktop
          resets to the section's own padding via md:px-0. */}
      <div
        ref={ref}
        className="flex md:grid md:grid-cols-3 gap-6
          overflow-x-auto md:overflow-visible
          snap-x snap-mandatory md:snap-none
          scrollbar-hide
          -mx-6 md:mx-0 px-[7.5vw] md:px-0
          pb-2 md:pb-0"
      >
        {services.map((service, i) => (
          <ServiceCard key={i} service={service} index={i} />
        ))}
      </div>

      {/* Mobile-only dot indicators */}
      <CarouselDots
        count={services.length}
        activeIndex={index}
        onSelect={scrollToIndex}
        label="Service packages"
        className="mt-6 md:hidden"
      />

      {/* À La Carte Add-ons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mt-20 border-t border-femme-dark/10 pt-16"
      >
        <h3 className="text-4xl text-femme-dark mb-3 font-system">À La Carte Add-ons</h3>
        <p className="text-femme-dark/60 text-base mb-10 font-system">
          Mix and match to make it yours.
        </p>
        <div className="flex flex-wrap gap-4">
          {addons.map((addon, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              transition={{ delay: i * 0.08, duration: 0.4, type: "spring", stiffness: 300, damping: 18 }}
              className="flex items-center gap-2.5 bg-femme-cream/70 border border-femme-plum/20 px-5 py-3 rounded-full cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-femme-plum shrink-0" />
              <span className="text-femme-dark text-base font-system">{addon}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
