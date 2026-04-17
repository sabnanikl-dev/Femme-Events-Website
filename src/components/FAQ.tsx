import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    question: "Where do you serve?",
    answer:
      "We're based in Atlanta, GA and primarily serve Atlanta and the surrounding metro area — Roswell, Decatur, Marietta, and beyond. For events 30+ miles outside Atlanta, a destination premium applies. Reach out and we'll let you know if we can make it work.",
  },
  {
    question: "How far in advance should I book?",
    answer:
      "The sooner the better — especially for full coordination packages. Most couples book 9–12 months out, but we've made 3-month timelines work too. Day-of coordination can sometimes be arranged with less lead time. Fill out an inquiry and we'll tell you what's possible for your date.",
  },
  {
    question: "Do you do destination weddings?",
    answer:
      "Yes! If you're dreaming of a wedding outside the Atlanta area, we're in. A destination premium applies for events 30+ miles from Atlanta to cover travel and logistics. Let's chat — no venue is too far for the right couple.",
  },
  {
    question: "What's the difference between your packages?",
    answer:
      "Just Show Up (Day-of) is for couples who've planned everything and just need someone to execute flawlessly on the day. Getting It Together (Partial) adds planning sessions, vendor support, and design direction. The Full Femme is end-to-end — design, planning, logistics, and everything in between. You can also mix in à la carte add-ons to any package.",
  },
  {
    question: "Can I customize my package?",
    answer:
      "Absolutely. Every wedding is different, and we're not big on one-size-fits-all. Our à la carte add-ons (rehearsal dinner coordination, welcome party, extra coordinators, and more) let you tailor any package to exactly what you need. Tell us your situation and we'll build something that fits.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Pricing is customized based on your package, guest count, date, and any add-ons — so we don't publish a flat rate. The best way to get a number is to fill out our inquiry form. We'll get back to you within 48 hours with details and we can go from there.",
  },
];

function FAQItem({ faq, index }: { faq: typeof faqs[0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.5, ease: "easeOut" }}
      className="border-b border-femme-plum/15 last:border-b-0"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center py-6 gap-6 text-left group cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-xl md:text-2xl text-femme-dark group-hover:text-femme-plum transition-colors duration-200 font-system">
          {faq.question}
        </span>
        <span className="shrink-0 w-8 h-8 rounded-full border border-femme-plum/40 flex items-center justify-center text-femme-plum group-hover:bg-femme-plum group-hover:text-white transition-colors duration-200">
          {open ? <Minus size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-femme-dark/70 text-base leading-relaxed font-system max-w-2xl">
              {faq.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQ() {
  return (
    <section className="py-24 px-6 md:px-24 bg-femme-pale">
      <div className="grid md:grid-cols-2 gap-16 items-start">
        {/* Left: heading */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="md:sticky md:top-32"
        >
          <h2 className="text-7xl md:text-8xl text-femme-dark italic leading-tight mb-4">
            Questions We Actually Get Asked
          </h2>
          <div className="h-1 w-32 bg-femme-orange mb-6" />
          <p className="text-femme-dark/60 text-lg font-system leading-relaxed">
            Still not sure? Fill out an inquiry — no pressure, just conversation.
          </p>
          <a
            href="#inquiry"
            className="inline-block mt-8 bg-femme-plum text-white px-8 py-3.5 rounded-full font-bold text-sm uppercase tracking-widest shadow-md hover:bg-femme-dark transition-colors duration-200 font-system"
          >
            Ask Us Directly
          </a>
        </motion.div>

        {/* Right: accordion */}
        <div className="flex flex-col">
          {faqs.map((faq, index) => (
            <FAQItem key={index} faq={faq} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
