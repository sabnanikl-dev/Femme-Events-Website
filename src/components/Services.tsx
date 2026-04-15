import { motion } from "motion/react";

const services = [
  {
    title: "The Visionary",
    price: "$1,200",
    description: "For the couple who has the vibe but needs the roadmap. We handle the aesthetics, vendor curation, and the 'big picture' logistics.",
    image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=800&auto=format&fit=crop"
  },
  {
    title: "The Coordinator",
    price: "$2,500",
    description: "Partial planning for the hands-on couple. We jump in 6 months out to tighten the screws and ensure your day is seamless.",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=800&auto=format&fit=crop"
  },
  {
    title: "The Full Femme",
    price: "$4,800",
    description: "From 'Yes' to 'I Do'. Every detail, every vendor, every kitschy touch handled with obsessive care. You just show up and look cool.",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop"
  }
];

export default function Services() {
  return (
    <section id="services" className="py-24 px-6 md:px-24 bg-femme-cream">
      <div className="mb-16">
        <h2 className="text-7xl text-femme-plum mb-4">Services That Save Sanity</h2>
        <div className="h-1 w-32 bg-femme-orange" />
      </div>

      <div className="grid md:grid-cols-3 gap-12">
        {services.map((service, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.2 }}
            className="flex flex-col group"
          >
            <div className="aspect-[4/5] overflow-hidden rounded-2xl mb-6 shadow-lg">
              <img 
                src={service.image} 
                alt={service.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
            </div>
            <h3 className="text-2xl text-femme-plum mb-1">{service.title}</h3>
            <span className="text-femme-orange font-bold mb-4 block">{service.price}</span>
            <p className="text-femme-dark/70 text-sm leading-relaxed mb-8 flex-grow">
              {service.description}
            </p>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 border-2 border-femme-plum text-femme-plum font-bold rounded-xl hover:bg-femme-plum hover:text-white transition-colors"
            >
              Book Now
            </motion.button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
