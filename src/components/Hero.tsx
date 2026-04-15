import { motion } from "motion/react";

export default function Hero() {
  return (
    <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden grain-bg">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1523438885200-e635ba2c371e?q=80&w=2000&auto=format&fit=crop" 
          alt="Floral background"
          className="w-full h-full object-cover opacity-80"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-femme-plum/20 via-transparent to-femme-plum/40" />
      </div>

      {/* Main Title */}
      <div className="relative z-10 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="text-[15vw] leading-[0.8] text-white uppercase drop-shadow-2xl"
        >
          Femme Events
        </motion.h1>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-12 left-0 right-0 z-10 px-12 flex justify-between items-end text-white text-sm font-medium">
        <div className="flex flex-col gap-1">
          <span className="opacity-60 text-[10px] uppercase tracking-widest">Location</span>
          <span>Atlanta, GA</span>
        </div>
        <div className="flex flex-col gap-1 text-center">
          <span className="opacity-60 text-[10px] uppercase tracking-widest">Email</span>
          <span>Amanda@FemmeEvents.com</span>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="opacity-60 text-[10px] uppercase tracking-widest">Social</span>
          <span>@_femmeevents</span>
        </div>
      </div>
    </section>
  );
}
