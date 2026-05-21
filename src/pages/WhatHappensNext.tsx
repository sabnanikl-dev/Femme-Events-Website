import { motion } from "motion/react";
import { Link } from "react-router-dom";

const timeline = [
  {
    number: "01",
    title: "Vendor contract review",
    description:
      "You send us your booked vendor contracts and contact information. We review everything to make sure no details are missing and the vendor coverage/timing is enough.",
  },
  {
    number: "02",
    title: "Vendor recommendations",
    description:
      "If you still need vendors, we recommend trusted vendor partners that fit your wedding.",
  },
  {
    number: "03",
    title: "First planning meeting",
    description:
      "We meet with you to create a mock timeline and floor plan.",
  },
  {
    number: "04",
    title: "Vendor alignment",
    description:
      "We send the mock timeline and floor plan to all vendors to confirm everything lines up with their expectations.",
  },
  {
    number: "05",
    title: "Revisions",
    description:
      "We make revisions based on vendor feedback and your preferences.",
  },
  {
    number: "06",
    title: "Check-in meeting",
    description:
      "Another meeting makes sure everything is running smoothly and gives you space to ask questions.",
  },
  {
    number: "07",
    title: "Final walkthrough",
    description:
      "All vendors are invited. Everyone reviews the details together so you, Femme, and the vendor team are fully aligned.",
  },
  {
    number: "08",
    title: "Final details",
    description:
      "After the walkthrough, we typically help with the seating chart and small finishing details like table numbers and similar items.",
  },
  {
    number: "09",
    title: "Rehearsal",
    description:
      "We run through the ceremony with you and your wedding party.",
  },
  {
    number: "10",
    title: "Wedding day management",
    description:
      "We set out personal items and DIY décor, stay with you all day, manage vendors, and keep the timeline moving.",
  },
  {
    number: "11",
    title: "End-of-night wrap-up",
    description:
      "At the end of the night, we pack up your items and close out the celebration.",
  },
];

export default function WhatHappensNextPage() {
  return (
    <main className="min-h-screen bg-femme-cream pt-32">
      <section className="px-6 pb-16 md:px-24 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-5xl"
        >
          <Link
            to="/"
            className="mb-8 inline-block text-sm font-bold uppercase tracking-widest text-femme-plum transition-colors duration-200 hover:text-femme-dark font-system"
          >
            ← Back to home
          </Link>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-femme-plum/70 font-system">
            After you book
          </p>
          <h1 className="mb-6 text-6xl italic text-femme-dark md:text-8xl lg:text-9xl">
            The Planning Flow
          </h1>
          <div className="h-1 w-32 bg-femme-orange" />
          <p className="mt-6 max-w-2xl text-xl leading-relaxed text-femme-dark/65 font-system">
            Once you decide Femme is the fit, this is the behind-the-scenes path from vendor review to the final packed box at the end of the night.
          </p>
        </motion.div>

        <ol className="mx-auto mt-14 grid max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          {timeline.map((step, index) => (
            <motion.li
              key={step.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: index * 0.04, duration: 0.5, ease: "easeOut" }}
              className="rounded-3xl border border-femme-plum/10 bg-white/45 p-6 shadow-[0_18px_50px_-30px_rgba(131,22,84,0.35)]"
            >
              <div className="mb-5 flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-femme-plum text-sm font-bold tracking-widest text-white font-system">
                  {step.number}
                </span>
                <span className="h-px flex-1 bg-femme-plum/15" aria-hidden="true" />
              </div>
              <h2 className="mb-3 text-3xl text-femme-dark font-balgin">
                {step.title}
              </h2>
              <p className="text-base leading-relaxed text-femme-dark/65 font-system">
                {step.description}
              </p>
            </motion.li>
          ))}
        </ol>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mx-auto mt-14 flex max-w-6xl flex-col gap-4 rounded-3xl bg-femme-pale/70 p-8 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <h2 className="text-3xl text-femme-dark font-balgin">
              Want us in your corner?
            </h2>
            <p className="mt-2 text-femme-dark/60 font-system">
              Start with the inquiry form and we’ll take it from there.
            </p>
          </div>
          <Link
            to="/#inquiry"
            className="inline-block rounded-full bg-femme-plum px-8 py-4 text-center text-sm font-bold uppercase tracking-widest text-white shadow-md transition-colors duration-200 hover:bg-femme-dark font-system"
          >
            Start Your Journey
          </Link>
        </motion.div>
      </section>
    </main>
  );
}
