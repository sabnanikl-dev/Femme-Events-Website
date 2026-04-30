export interface Vendor {
  name: string;
  specialty: string;
  url?: string;
  instagram?: string;
  image?: string;
}

export interface VendorCategory {
  label: string;
  vendors: Vendor[];
}

export const vendorCategories: VendorCategory[] = [
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
