import { useState, useEffect } from "react";
import { motion } from "motion/react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-4 left-4 right-4 z-50 px-6 py-3 flex justify-between items-center rounded-2xl transition-all duration-300 ${
        scrolled
          ? "bg-femme-cream/95 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <a href="#" aria-label="Femme Events home">
        <img
          src="/logo-nav.svg"
          alt="Femme Events"
          className="h-8 w-auto transition-all duration-300"
          style={scrolled ? {} : { filter: "brightness(0) invert(1)" }}
        />
      </a>

      <div
        className={`flex gap-8 text-sm uppercase tracking-widest font-medium transition-colors duration-300 ${
          scrolled ? "text-femme-dark" : "text-white"
        }`}
      >
        <a href="#about" className="hover:opacity-60 transition-opacity">About</a>
        <a href="#services" className="hover:opacity-60 transition-opacity">Services</a>
        <a href="#inquiry" className="hover:opacity-60 transition-opacity">Inquiry</a>
      </div>
    </motion.nav>
  );
}
