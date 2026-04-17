import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { NavLink, useLocation } from "react-router-dom";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  useEffect(() => {
    // Non-home pages always show the scrolled (solid) navbar
    if (!isHome) {
      setScrolled(true);
      return;
    }
    setScrolled(window.scrollY > 60);
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  // Anchor links resolve correctly from any page
  const anchor = (hash: string) => (isHome ? hash : `/${hash}`);

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
      <a href={anchor("#")} aria-label="Femme Events home">
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
        <a href={anchor("#about")} className="hover:opacity-60 transition-opacity">About</a>
        <a href={anchor("#services")} className="hover:opacity-60 transition-opacity">Services</a>
        <NavLink
          to="/journal"
          className={({ isActive }) =>
            `hover:opacity-60 transition-opacity${isActive ? " opacity-60" : ""}`
          }
        >
          Journal
        </NavLink>
        <a href={anchor("#inquiry")} className="hover:opacity-60 transition-opacity">Inquiry</a>
      </div>
    </motion.nav>
  );
}
