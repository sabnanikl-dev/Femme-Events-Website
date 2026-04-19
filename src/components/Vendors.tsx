import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";

interface Vendor {
  name: string;
  specialty: string;
  url?: string;
}

interface VendorCategory {
  label: string;
  vendors: Vendor[];
}

const vendorCategories: VendorCategory[] = [
  {
    label: "Venues",
    vendors: [
      { name: "The Estate", specialty: "Historic mansion & gardens", url: "#" },
      { name: "Barnsley Resort", specialty: "Rustic-luxury destination", url: "#" },
      { name: "The Carlyle", specialty: "Elegant ballroom", url: "#" },
    ],
  },
  {
    label: "Florists",
    vendors: [
      { name: "Twisted Willow", specialty: "Organic garden-style arrangements", url: "#" },
      { name: "Flora Fauna", specialty: "Modern sculptural designs", url: "#" },
    ],
  },
  {
    label: "Photographers",
    vendors: [
      { name: "Elyssa Beach", specialty: "Film & fine art wedding photography", url: "#" },
      { name: "Fern & Frond", specialty: "Documentary-style storytelling", url: "#" },
    ],
  },
  {
    label: "Catering & Bar",
    vendors: [
      { name: "Elegant Events", specialty: "Southern-inspired catering", url: "#" },
      { name: "The Pour Company", specialty: "Craft cocktail bar service", url: "#" },
    ],
  },
  {
    label: "Hair & Makeup",
    vendors: [
      { name: "Glamour ATA", specialty: "On-site bridal beauty team", url: "#" },
    ],
  },
  {
    label: "Music & DJ",
    vendors: [
      { name: "Atlanta Music Exchange", specialty: "Live bands & DJ packages", url: "#" },
    ],
  },
];

function VendorCard({ vendor, index }: { vendor: Vendor; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
      className="group flex items-center justify-between gap-3 bg-femme-cream/60 border border-femme-pink/30 px-5 py-3.5 rounded-xl hover:bg-femme-cream transition-colors duration-200"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-femme-dark text-base font-balgin truncate">
          {vendor.name}
        </span>
        <span className="text-femme-dark/50 text-xs font-system truncate">
          {vendor.specialty}
        </span>
      </div>
      {vendor.url && (
        <a
          href={vendor.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 w-7 h-7 rounded-full border border-femme-plum/40 text-femme-plum flex items-center justify-center
            opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-femme-plum hover:text-white transition-all duration-200"
          aria-label={`Visit ${vendor.name}`}
        >
          <ExternalLink size={13} strokeWidth={2} />
        </a>
      )}
    </motion.li>
  );
}

export default function Vendors() {
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
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
        {vendorCategories.map((cat, catIndex) => (
          <motion.div
            key={cat.label}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: catIndex * 0.1, duration: 0.5, ease: "easeOut" }}
          >
            <h3 className="text-2xl text-femme-plum font-balgin mb-4 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-femme-orange shrink-0" />
              {cat.label}
            </h3>
            <ul className="flex flex-col gap-3">
              {cat.vendors.map((vendor, i) => (
                <VendorCard key={vendor.name} vendor={vendor} index={i} />
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

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
    </section>
  );
}
