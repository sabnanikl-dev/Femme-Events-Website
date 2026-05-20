import { motion } from "motion/react";

const steps = [
  {
    number: "01",
    label: "Vendor contract review",
    description:
      "Send us your booked vendor contracts and contact info. We review the details, coverage, and timing so nothing important is missing.",
  },
  {
    number: "02",
    label: "Vendor recommendations",
    description:
      "Still filling gaps? We recommend trusted vendor partners who fit your wedding style, budget, and needs.",
  },
  {
    number: "03",
    label: "First planning meeting",
    description:
      "We meet with you to build the first version of your wedding-day timeline and floor plan.",
  },
  {
    number: "04",
    label: "Vendor alignment",
    description:
      "We send the mock timeline and floor plan to every vendor so everyone can confirm expectations early.",
  },
  {
    number: "05",
    label: "Revisions",
    description:
      "We refine the plan based on vendor feedback, your preferences, and the small details that make the day feel like you.",
  },
  {
    number: "06",
    label: "Check-in meeting",
    description:
      "Another planning touchpoint keeps everything moving smoothly and gives you space to ask questions.",
  },
  {
    number: "07",
    label: "Final walkthrough",
    description:
      "All vendors are invited. We walk through the details together so you, Femme, and the vendor team are fully aligned.",
  },
  {
    number: "08",
    label: "Final details",
    description:
      "After the walkthrough, we help close out finishing touches like seating charts, table numbers, and personal details.",
  },
  {
    number: "09",
    label: "Rehearsal",
    description:
      "We run through the ceremony with you and the wedding party so everyone knows where to be and when.",
  },
  {
    number: "10",
    label: "Wedding day management",
    description:
      "We set out personal items and DIY décor, stay with you all day, manage vendors, and keep the timeline moving.",
  },
  {
    number: "11",
    label: "End-of-night wrap-up",
    description:
      "At the end of the night, we pack up your items and close out the celebration with care.",
  },
];

export default function Process() {
  return (
    <section className="py-16 md:py-24 px-6 md:px-24 bg-femme-cream overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-14 md:mb-18"
      >
        <h2 className="text-6xl md:text-8xl lg:text-9xl text-femme-dark italic mb-4">
          What Happens Next
        </h2>
        <div className="h-1 w-32 bg-femme-orange" />
        <p className="mt-6 text-femme-dark/60 text-xl font-system max-w-2xl">
          From the first vendor review to the final packed box, here’s how we keep the planning clear and the wedding day calm.
        </p>
      </motion.div>

      <ol className="relative grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, index) => (
          <motion.li
            key={step.number}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: index * 0.04, duration: 0.5, ease: "easeOut" }}
            className="relative min-h-full rounded-3xl border border-femme-plum/10 bg-white/45 p-6 shadow-[0_18px_50px_-30px_rgba(131,22,84,0.35)]"
          >
            <div className="mb-5 flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-femme-plum text-sm font-bold tracking-widest text-white font-system">
                {step.number}
              </span>
              <span className="h-px flex-1 bg-femme-plum/15" aria-hidden="true" />
            </div>

            <h3 className="mb-3 text-3xl text-femme-dark font-balgin">
              {step.label}
            </h3>
            <p className="text-femme-dark/65 text-base leading-relaxed font-system">
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
        className="mt-14 md:mt-18 flex flex-col md:flex-row md:items-center gap-4 md:gap-6"
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
