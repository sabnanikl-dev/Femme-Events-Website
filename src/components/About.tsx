import { motion } from "motion/react";

export default function About() {
  return (
    <section id="about" className="py-24 px-6 md:px-24 bg-femme-lavender grid md:grid-cols-[2fr_3fr] gap-16 items-center">
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative"
      >
        <img
          src="/photos/pt2.jpg"
          alt="Bridal detail flat lay with shoes, invitation and rings"
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
        <h2 className="text-7xl md:text-8xl text-femme-dark leading-tight italic">
          Why We Obsess Over&nbsp;"I Do"
        </h2>
        <p className="text-femme-dark/80 text-2xl leading-relaxed max-w-lg">
          Look, anyone can book a ballroom. We zero in on the tiny moments—grandma's happy tears, the inside joke on the cocktail napkin, the playlist that makes cousins dance together on purpose.
        </p>
        <motion.a
          href="#services"
          whileHover={{ scale: 1.03, backgroundColor: "#570f38" }}
          whileTap={{ scale: 0.97 }}
          className="bg-femme-plum text-white px-12 py-4 rounded-full font-medium text-base w-fit shadow-lg transition-colors duration-200 cursor-pointer"
        >
          Learn More
        </motion.a>
      </motion.div>
    </section>
  );
}
