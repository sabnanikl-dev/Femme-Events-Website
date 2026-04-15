import { motion } from "motion/react";

export default function About() {
  return (
    <section id="about" className="py-24 px-6 md:px-24 bg-femme-pale grid md:grid-cols-2 gap-16 items-center">
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="relative aspect-square"
      >
        <img 
          src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=1000&auto=format&fit=crop" 
          alt="Wedding details"
          className="w-full h-full object-cover rounded-2xl shadow-2xl"
          referrerPolicy="no-referrer"
        />
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-femme-orange rounded-full flex items-center justify-center text-white font-display italic text-xl -rotate-12 shadow-lg">
          Kitschy!
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="flex flex-col gap-8"
      >
        <h2 className="text-6xl text-femme-plum leading-tight">
          Why We Obsess Over "I Do"
        </h2>
        <p className="text-femme-dark/80 text-lg leading-relaxed max-w-lg">
          Look, anyone can book a ballroom. We zero in on the tiny moments—grandma's happy tears, the inside joke on the cocktail napkin, the playlist that makes cousins dance together on purpose.
        </p>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-femme-plum text-white px-12 py-4 rounded-full font-medium text-sm w-fit shadow-xl hover:bg-femme-dark transition-colors"
        >
          Learn More
        </motion.button>
      </motion.div>
    </section>
  );
}
