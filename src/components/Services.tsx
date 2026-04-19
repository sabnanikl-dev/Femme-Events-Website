import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const services = [
  {
    title: "Just Show Up",
    subtitle: "Day-of Coordination",
    image: "/photos/pt3.jpg",
    alt: "Couple sharing a moment by arched window",
    includes: [
      "Initial consultation + venue walkthrough",
      "Vendor coordination (contracts, timelines, contact info)",
      "Detailed day-of timeline",
      "8-hour day-of coordination with 2 coordinators",
      "Rehearsal coordination",
      "Post-wedding vendor tip management",
      "Items pickup and venue breakdown oversight",
    ],
    note: "Add-on: Extended coverage (+4 hours) available",
  },
  {
    title: "Getting It Together",
    subtitle: "Partial Planning",
    image: "/photos/kj1.jpg",
    alt: "Couple sharing a kiss in the car after their ceremony",
    includes: [
      "Everything in Day-of Coordination, plus:",
      "3–4 planning sessions (virtual or in-person)",
      "Vendor recommendations + meeting attendance (up to 3)",
      "Design concept development + mood boards",
      "Budget tracking and management",
      "Decor coordination (what to buy, where, and how to set it up)",
    ],
    note: null,
  },
  {
    title: "The Full Femme",
    subtitle: "Full Coordination + Design",
    image: "/photos/kj2.jpg",
    alt: "Couple celebrating their grand exit through a confetti send-off",
    includes: [
      "Everything in Partial Planning, plus:",
      "Full design direction (color palette, mood, aesthetic guidance)",
      "DIY decor sourcing + creation coordination",
      "Unlimited planning support (text / email / Voxer)",
      "Welcome bag + stationery design guidance",
      "Day-after brunch coordination (if applicable)",
      "Post-wedding social media content strategy",
    ],
    note: null,
  },
];

const addons = [
  "Rehearsal dinner coordination",
  "Welcome party coordination",
  "Decor package (setup + breakdown only)",
  "Destination wedding premium (30+ miles)",
  "Second coordinator",
];

function ServiceCard({ service, index }: { service: typeof services[0]; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15, duration: 0.6, ease: "easeOut" }}
      className="relative h-[700px] rounded-2xl overflow-hidden cursor-pointer shadow-xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Full-bleed photo */}
      <motion.img
        src={service.image}
        alt={service.alt}
        className="absolute inset-0 w-full h-full object-cover object-center"
        animate={{ scale: hovered ? 1.06 : 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* Base gradient — always visible at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-femme-dark/90 via-femme-dark/30 to-transparent" />

      {/* Hover overlay — deepens the gradient */}
      <motion.div
        className="absolute inset-0 bg-femme-dark/40"
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />

      {/* Card content */}
      <div className="absolute inset-0 flex flex-col justify-end p-8">

        {/* Bullet list — slides up on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.ul
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex flex-col gap-2 mb-6"
            >
              {service.includes.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="flex gap-2.5 items-start"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-femme-pink shrink-0 mt-[6px]" />
                  <span className="text-white/90 text-sm leading-snug font-system">{item}</span>
                </motion.li>
              ))}
              {service.note && (
                <li className="text-white/50 text-xs italic pl-4 font-system mt-1">{service.note}</li>
              )}
            </motion.ul>
          )}
        </AnimatePresence>

        {/* Title block — always visible */}
        <div className="mb-5">
          <h3
            className="text-white text-6xl leading-tight mb-2"
            style={{ fontFamily: "Frunchy Sage, serif", fontWeight: "bold" }}
          >
            {service.title}
          </h3>
          <p
            className="text-femme-pink text-sm uppercase tracking-[0.25em] font-bold font-system"
          >
            {service.subtitle}
          </p>
        </div>

        {/* Book Now button — links to inquiry section */}
        <motion.a
          href="#inquiry"
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
  return (
    <section id="services" className="py-24 px-6 md:px-24 bg-femme-lavender">
      {/* Header */}
      <div className="mb-16">
        <h2 className="text-8xl md:text-9xl text-femme-dark mb-4 italic font-bold">
          Services That Save Sanity
        </h2>
        <div className="h-1 w-32 bg-femme-orange" />
      </div>

      {/* Service Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {services.map((service, index) => (
          <ServiceCard key={index} service={service} index={index} />
        ))}
      </div>

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
