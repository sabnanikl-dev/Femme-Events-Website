import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ExternalLink, Instagram, X } from "lucide-react";
import { instagramUrl } from "../../lib/vendors";
import { trackEvent } from "../../lib/analytics";

interface VendorOverlayCardProps {
  name: string;
  specialty: string;
  category: string;
  image?: string;
  url?: string;
  instagram?: string;
  onClose: () => void;
}

function getInitials(name: string): string {
  const tokens = name
    .replace(/&/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].charAt(0).toUpperCase();
  return (tokens[0].charAt(0) + tokens[tokens.length - 1].charAt(0)).toUpperCase();
}

export default function VendorOverlayCard({
  name,
  specialty,
  category,
  image,
  url,
  instagram,
  onClose,
}: VendorOverlayCardProps) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const igLink = instagramUrl(instagram);
  const websiteLink = url && url !== "#" ? url : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while the overlay is mounted. Restores whatever
  // value `overflow` had before — defensive in case another component
  // already manages it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-femme-dark/50 backdrop-blur-sm"
      aria-hidden="false"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-overlay-name"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-3xl bg-femme-cream p-8 shadow-[0_20px_60px_-15px_rgba(131,22,84,0.35)]"
      >
        {/* Close button */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Close vendor details"
          className="absolute right-4 top-4 w-9 h-9 rounded-full bg-femme-pale text-femme-plum
            flex items-center justify-center
            hover:bg-femme-plum hover:text-white transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-femme-orange focus:ring-offset-2 focus:ring-offset-femme-cream"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        {/* Photo or initials */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="h-28 w-28 rounded-full bg-femme-pale border-4 border-femme-cream shadow-[0_8px_24px_-8px_rgba(131,22,84,0.4)] overflow-hidden flex items-center justify-center">
              {image ? (
                <img
                  src={image}
                  alt={name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="text-femme-plum text-3xl font-bold font-balgin"
                  aria-hidden="true"
                >
                  {getInitials(name)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Name + specialty */}
        <div className="text-center mb-5">
          <h3
            id="vendor-overlay-name"
            className="text-femme-dark text-3xl font-balgin mb-2"
          >
            {name}
          </h3>
          <p className="text-femme-dark/60 text-sm font-system leading-relaxed">
            {specialty}
          </p>
        </div>

        {/* Category pill */}
        <div className="flex justify-center mb-7">
          <span className="inline-flex items-center gap-2 bg-femme-plum text-white text-xs font-bold uppercase tracking-widest font-system px-4 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-femme-orange" />
            {category}
          </span>
        </div>

        {/* Action buttons — only render when data exists */}
        {(websiteLink || igLink) && (
          <div className="flex gap-3">
            {websiteLink && (
              <a
                href={websiteLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("vendor_link_click", { type: "website", vendor: name })}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full
                  bg-femme-plum text-white text-sm font-bold uppercase tracking-widest font-system
                  hover:bg-femme-deep transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-femme-orange focus:ring-offset-2 focus:ring-offset-femme-cream"
              >
                <ExternalLink size={15} strokeWidth={2.25} />
                Website
              </a>
            )}
            {igLink && (
              <a
                href={igLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("vendor_link_click", { type: "instagram", vendor: name })}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full
                  bg-femme-pale text-femme-plum text-sm font-bold uppercase tracking-widest font-system
                  border border-femme-plum/20
                  hover:bg-femme-plum hover:text-white hover:border-femme-plum transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-femme-orange focus:ring-offset-2 focus:ring-offset-femme-cream"
              >
                <Instagram size={15} strokeWidth={2.25} />
                Instagram
              </a>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
