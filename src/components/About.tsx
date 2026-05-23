import { motion } from "motion/react";
import SafeText from "./SafeText";

const aboutParagraphs = [
  `As women, we're told a wedding is supposed to be the "most important day of our lives." And listen, we know life has plenty of other milestones worth screaming about: the promotion, the degree, the first home, the babies if you want them, the version of yourself you worked hard to become.`,
  `But a wedding is still pretty damn cool.`,
  `It might be the one time all of your people are in the same room. The moment two lives, two families, and sometimes two cultures get woven together in front of everyone who loves you. It is emotional. It is chaotic. It is kind of a big deal.`,
  `And we love the girlhood of it all: the dresses, makeup, heels, glitter, lashes, perfume, happy tears, group chats, moms, grandmothers, sisters, and girlfriends showing up with overwhelming love. It is such a feminine, personal, once-in-a-lifetime kind of energy, and Femme Events exists to protect that feeling while making sure the logistics do not eat it alive.`,
];

export default function About() {
  return (
    <section id="about" className="py-16 md:py-24 px-6 md:px-24 bg-femme-lavender grid md:grid-cols-[2fr_3fr] gap-12 md:gap-16 items-center overflow-x-clip">
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative w-full md:w-4/5 md:ml-auto"
      >
        <img
          src="/photos/pt2.jpg"
          alt="Bridal detail flat lay with shoes, invitation and rings"
          loading="lazy"
          decoding="async"
          className="w-full h-auto object-contain shadow-2xl"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="flex flex-col gap-8"
      >
        <h2 className="text-5xl md:text-8xl text-femme-dark leading-tight italic">
          <SafeText text='Why We Obsess Over "I Do"' />
        </h2>
        <div className="flex flex-col gap-5 text-femme-dark/80 text-lg md:text-xl leading-relaxed max-w-xl font-system">
          {aboutParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <motion.a
          href="#services"
          whileHover={{ scale: 1.03, backgroundColor: "var(--color-femme-deep)" }}
          whileTap={{ scale: 0.97 }}
          className="bg-femme-plum text-white px-12 py-4 rounded-full font-medium text-base w-fit shadow-lg transition-colors duration-200 cursor-pointer"
        >
          Learn More
        </motion.a>
      </motion.div>
    </section>
  );
}
