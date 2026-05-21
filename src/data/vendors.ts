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
    label: "Florals & Design",
    vendors: [
      {
        name: "Blosm Design",
        specialty: "Wedding floral and event design studio",
        url: "https://blosmdesign.com/",
        instagram: "https://www.instagram.com/blosmdesign/",
      },
      {
        name: "Moss & Clay Floral Design",
        specialty: "Atlanta floral design for weddings and events",
        url: "https://www.mossandclay.com/",
        instagram: "https://www.instagram.com/_mossandclay_/",
      },
      {
        name: "JLD Designs",
        specialty: "Full-service wedding and event design",
        url: "https://jlddesignsllc.com/",
        instagram: "https://www.instagram.com/jlddesignsllc/",
      },
    ],
  },
  {
    label: "Music & Entertainment",
    vendors: [
      {
        name: "Atlanta Wedding Band",
        specialty: "Live wedding band and dance-floor entertainment",
        url: "https://atlantaweddingband.com/",
        instagram: "https://www.instagram.com/atlantaweddingband/",
      },
      {
        name: "Gold Headphones Events",
        specialty: "Atlanta wedding DJ and MC entertainment",
        url: "https://www.goldheadphones.com/",
        instagram: "https://www.instagram.com/goldheadphonesevents/",
      },
      {
        name: "One Night Entertainment",
        specialty: "Wedding and event DJ company",
        url: "https://www.onenightatl.com/",
        instagram: "https://www.instagram.com/onenightatl/",
      },
    ],
  },
  {
    label: "Photo & Video",
    vendors: [
      {
        name: "2KFILMS",
        specialty: "Cinematic wedding films and photography",
        url: "https://2kfilms.net/weddings",
        instagram: "https://www.instagram.com/2kfilms_weddings/",
      },
      {
        name: "Happykoi Studios",
        specialty: "Wedding and event visual storytelling",
        url: "https://happykoistudios.com/",
        instagram: "https://www.instagram.com/happykoistudios/",
      },
      {
        name: "Hiyam Yacout Photography",
        specialty: "Atlanta wedding and portrait photography",
        url: "https://www.hiyamyacout.com/",
        instagram: "https://www.instagram.com/hiyam.jpg/",
      },
      {
        name: "Gabbie Rhea Photography",
        specialty: "Light, colorful Atlanta wedding photography",
        url: "https://gabbierheaphoto.com/",
        instagram: "https://www.instagram.com/gabrielle_rhea/",
      },
      {
        name: "Heavenly Imagery",
        specialty: "Photography and videography for weddings and events",
        url: "https://www.heavenlyimagery.com/",
        instagram: "https://www.instagram.com/heavenlyimagery/",
      },
    ],
  },
  {
    label: "Catering",
    vendors: [
      {
        name: "Endive Fine Catering",
        specialty: "Chef-led fine catering for weddings and events",
        url: "https://endiveatlanta.com/",
        instagram: "https://www.instagram.com/endive.catering/",
      },
      {
        name: "Proof of the Pudding",
        specialty: "Wedding catering and event services",
        url: "https://www.proofpudding.com/weddings/",
        instagram: "https://www.instagram.com/proofthepudding/",
      },
      {
        name: "Affairs to Remember",
        specialty: "Luxury catering and full-service event production",
        url: "https://affairs.com/",
        instagram: "https://www.instagram.com/_affairs_to_remember_/",
      },
      {
        name: "Low Country Catering",
        specialty: "Full-service Atlanta wedding catering",
        url: "https://lowcountrycatering.net/",
        instagram: "https://www.instagram.com/lowcountrycatering/",
      },
    ],
  },
  {
    label: "Desserts",
    vendors: [
      {
        name: "Frosted Pumpkin Wedding Cakes",
        specialty: "Custom wedding cakes and dessert design",
        url: "https://frostedpumpkin.com/",
        instagram: "https://www.instagram.com/frostedpumpkincakes/",
      },
    ],
  },
];
