import { motion } from "motion/react";
import { Link } from "react-router-dom";

const storyParagraphs = [
  `Femme Events started with a simple frustration: weddings can feel way too obsessed with rules.`,
  `Tradition can be beautiful, but it should feel like an option, not a strict set of instructions. Amanda built Femme for the brides, couples, and friend groups who want space to be fully themselves: cool, silly, sentimental, dramatic, hyper-feminine, alternative, non-traditional, different, or completely impossible to put in a box.`,
  `When you work with Femme, you get someone completely in your corner. Someone calm under pressure. Someone organized enough to catch the tiny details, but flexible enough to never say, "that's not how it's usually done." Someone who will be kind to your people, kind to your vendors, and protective of the energy you want your wedding to hold.`,
];

const closingLine = `You guide the feeling. We handle everything else.`;

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-femme-lavender pt-32">
      <section className="px-6 pb-16 md:px-24 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-3xl"
        >
          <Link
            to="/"
            className="mb-8 inline-block text-sm font-bold uppercase tracking-widest text-femme-plum transition-colors duration-200 hover:text-femme-dark font-system"
          >
            ← Back to home
          </Link>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-femme-plum/70 font-system">
            Our Story
          </p>
          <h1 className="mb-6 text-5xl italic text-femme-dark md:text-7xl">
            For celebrations with feeling, personality, and a plan.
          </h1>
          <div className="h-1 w-32 bg-femme-orange" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="mx-auto mt-10 flex max-w-3xl flex-col gap-6 text-lg leading-relaxed text-femme-dark/75 md:text-xl font-system"
        >
          {storyParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <p className="mt-2 text-3xl italic leading-snug text-femme-plum md:text-4xl">
            {closingLine}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mx-auto mt-14 flex max-w-3xl flex-col gap-4 rounded-3xl bg-femme-pale/70 p-8 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <h2 className="text-3xl text-femme-dark font-balgin">
              Ready when you are
            </h2>
            <p className="mt-2 text-femme-dark/60 font-system">
              Tell us about your wedding and we'll take it from there.
            </p>
          </div>
          <a
            href="/#inquiry"
            className="inline-block rounded-full bg-femme-plum px-8 py-4 text-center text-sm font-bold uppercase tracking-widest text-white shadow-md transition-colors duration-200 hover:bg-femme-dark font-system"
          >
            Start Your Inquiry
          </a>
        </motion.div>
      </section>
    </main>
  );
}
