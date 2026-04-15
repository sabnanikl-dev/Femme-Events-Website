import { motion } from "motion/react";

export default function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center mix-blend-difference text-white"
    >
      <div className="text-2xl font-display font-black tracking-tighter">
        FE
      </div>
      <div className="flex gap-8 text-xs uppercase tracking-widest font-medium">
        <a href="#about" className="hover:opacity-60 transition-opacity">About</a>
        <a href="#services" className="hover:opacity-60 transition-opacity">Services</a>
        <a href="#inquiry" className="hover:opacity-60 transition-opacity">Inquiry</a>
      </div>
    </motion.nav>
  );
}
