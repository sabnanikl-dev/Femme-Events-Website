import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    setScrolled(window.scrollY > 60);
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close the mobile panel if the viewport widens into the desktop range
  // (panel becomes md:hidden — leaving it "open" would orphan the scroll lock).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const getFocusable = (): HTMLElement[] => {
      const links = panelRef.current
        ? Array.from(panelRef.current.querySelectorAll<HTMLElement>("a"))
        : [];
      return toggleRef.current ? [toggleRef.current, ...links] : links;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (active && !focusable.includes(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    const firstLink = panelRef.current?.querySelector<HTMLElement>("a");
    firstLink?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const anchor = (hash: string) => (isHome ? hash : `/${hash}`);
  const closeMenu = () => setMenuOpen(false);

  const linkClass = "hover:opacity-60 transition-opacity";
  const mobileLinkClass =
    "block px-4 py-3 min-h-[44px] text-femme-dark text-base uppercase tracking-widest font-medium hover:bg-femme-cream rounded-lg [touch-action:manipulation]";

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed top-4 left-4 right-4 z-50 px-6 py-3 flex justify-between items-center rounded-2xl transition-all duration-300 ${
          scrolled || menuOpen
            ? "bg-femme-cream/95 backdrop-blur-md shadow-sm"
            : "bg-transparent"
        }`}
      >
        <a href={anchor("#")} aria-label="Femme Events home" onClick={closeMenu}>
          <img
            src="/logo-nav.svg"
            alt="Femme Events"
            decoding="async"
            className="h-8 w-auto transition-all duration-300"
            style={scrolled || menuOpen ? {} : { filter: "brightness(0) invert(1)" }}
          />
        </a>

        {/* Desktop links */}
        <div
          className={`hidden md:flex gap-8 text-sm uppercase tracking-widest font-medium transition-colors duration-300 ${
            scrolled ? "text-femme-dark" : "text-white"
          }`}
        >
          <a href={anchor("#about")} className={linkClass}>About</a>
          <a href={anchor("#services")} className={linkClass}>Services</a>
          <NavLink
            to="/journal"
            className={({ isActive }) =>
              `${linkClass}${isActive ? " opacity-60" : ""}`
            }
          >
            Journal
          </NavLink>
          <a href={anchor("#inquiry")} className={linkClass}>Inquiry</a>
        </div>

        {/* Mobile hamburger toggle */}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-panel"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className={`md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] -mr-2 rounded-lg [touch-action:manipulation] transition-colors duration-200 ${
            scrolled || menuOpen ? "text-femme-dark hover:bg-femme-pale/60" : "text-white hover:bg-white/10"
          }`}
        >
          {menuOpen ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={2} />}
        </button>
      </motion.nav>

      {/* Mobile slide-out panel + backdrop */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeMenu}
              className="md:hidden fixed inset-0 z-40 bg-femme-dark/40 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              key="panel"
              ref={panelRef}
              id="mobile-nav-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="md:hidden fixed top-20 left-4 right-4 z-50 bg-femme-cream/98 backdrop-blur-md rounded-2xl shadow-lg p-3 flex flex-col gap-1"
            >
              <a href={anchor("#about")} onClick={closeMenu} className={mobileLinkClass}>About</a>
              <a href={anchor("#services")} onClick={closeMenu} className={mobileLinkClass}>Services</a>
              <NavLink to="/journal" onClick={closeMenu} className={mobileLinkClass}>
                Journal
              </NavLink>
              <a href={anchor("#inquiry")} onClick={closeMenu} className={mobileLinkClass}>Inquiry</a>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
