import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  getInitialVendorCategories,
  getVendorCategories,
  type Vendor,
  type VendorCategory,
} from "../lib/vendors";
import { vendorCategories as fallbackCategories } from "../data/vendors";
import VendorOverlayCard from "./ui/VendorOverlayCard";

interface SelectedVendor {
  vendor: Vendor;
  category: string;
}

function VendorCard({
  vendor,
  index,
  onOpen,
}: {
  vendor: Vendor;
  index: number;
  onOpen: () => void;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${vendor.name} details`}
      className="group flex w-full max-w-full box-border items-center justify-between gap-3 bg-femme-cream/60 border border-femme-pink/30 px-5 py-3.5 rounded-xl
        hover:bg-femme-cream hover:border-femme-plum/40 transition-colors duration-200
        cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-femme-orange focus:ring-offset-2 focus:ring-offset-femme-cream"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-femme-dark text-base font-balgin truncate">
          {vendor.name}
        </span>
        <span className="text-femme-dark/50 text-xs font-system truncate">
          {vendor.specialty}
        </span>
      </div>
    </motion.li>
  );
}

export default function Vendors() {
  const [categories, setCategories] = useState<VendorCategory[]>(
    () => getInitialVendorCategories() ?? fallbackCategories,
  );
  const [errored, setErrored] = useState(false);
  const [selected, setSelected] = useState<SelectedVendor | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVendorCategories()
      .then((data) => {
        if (cancelled) return;
        if (data.length === 0) setErrored(true);
        else setCategories(data);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="py-16 md:py-24 px-6 md:px-24 bg-femme-cream">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-16"
      >
        <h2 className="text-6xl md:text-8xl lg:text-9xl text-femme-dark italic mb-4">
          Our People
        </h2>
        <p className="text-femme-dark/60 text-lg font-system max-w-xl">
          We've worked with the best in Atlanta. These are the vendors we trust
          to show up, deliver, and make your day feel effortless.
        </p>
        <div className="h-1 w-32 bg-femme-orange mt-6" />
      </motion.div>

      {/* Category Grid */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-2 lg:grid-cols-3 gap-10 min-w-0">
          {categories.map((cat, catIndex) => (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: catIndex * 0.1, duration: 0.5, ease: "easeOut" }}
              className="min-w-0"
            >
              <h3 className="text-2xl text-femme-plum font-balgin mb-4 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-femme-orange shrink-0" />
                {cat.label}
              </h3>
              <ul className="flex flex-col gap-3 min-w-0 max-w-full">
                {cat.vendors.map((vendor, i) => (
                  <VendorCard
                    key={vendor.name}
                    vendor={vendor}
                    index={i}
                    onOpen={() =>
                      setSelected({ vendor, category: cat.label })
                    }
                  />
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-femme-dark/45 text-base font-system text-center py-16">
          {errored
            ? "Vendor list is taking a moment to load — check back shortly."
            : "Vendor recommendations coming soon."}
        </p>
      )}

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mt-20 text-center"
      >
        <p className="text-femme-dark/50 text-sm font-system mb-5">
          Want recommendations for something not listed here?
        </p>
        <a
          href="#inquiry"
          className="inline-block px-8 py-3.5 text-sm font-bold uppercase tracking-widest font-system
            bg-femme-plum text-white border-2 border-femme-plum
            hover:bg-femme-mauve hover:border-femme-mauve
            transition-colors duration-200 rounded-sm"
        >
          Ask Us
        </a>
      </motion.div>

      <AnimatePresence>
        {selected && (
          <VendorOverlayCard
            key={`${selected.category}-${selected.vendor.name}`}
            name={selected.vendor.name}
            specialty={selected.vendor.specialty}
            category={selected.category}
            image={selected.vendor.image}
            url={selected.vendor.url}
            instagram={selected.vendor.instagram}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
