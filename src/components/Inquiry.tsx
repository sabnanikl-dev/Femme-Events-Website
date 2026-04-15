import { motion } from "motion/react";

export default function Inquiry() {
  return (
    <section id="inquiry" className="py-24 px-6 md:px-24 bg-femme-pale grid md:grid-cols-2 gap-16">
      <div className="flex flex-col gap-6">
        <h2 className="text-7xl text-femme-plum leading-[0.9]">
          Ready to Chat Dates & Dreams?
        </h2>
        <p className="text-femme-dark/70 text-lg">
          Drop us a line and let's see if your calendar and our magic align.
        </p>
      </div>

      <motion.form 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex flex-col gap-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-bold opacity-60">First Name</label>
            <input type="text" className="bg-transparent border-b-2 border-femme-plum/30 py-2 focus:border-femme-plum outline-none transition-colors" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-bold opacity-60">Last Name</label>
            <input type="text" className="bg-transparent border-b-2 border-femme-plum/30 py-2 focus:border-femme-plum outline-none transition-colors" />
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest font-bold opacity-60">Email</label>
          <input type="email" className="bg-transparent border-b-2 border-femme-plum/30 py-2 focus:border-femme-plum outline-none transition-colors" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest font-bold opacity-60">Message</label>
          <textarea rows={4} className="bg-transparent border-b-2 border-femme-plum/30 py-2 focus:border-femme-plum outline-none transition-colors resize-none" />
        </div>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-femme-plum text-white py-4 rounded-xl font-bold shadow-xl hover:bg-femme-dark transition-colors mt-4"
        >
          Send Inquiry
        </motion.button>
      </motion.form>
    </section>
  );
}
