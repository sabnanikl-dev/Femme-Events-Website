import { motion } from "motion/react";
import { ButtonCta } from "@/components/ui/button-shiny";

export default function Hero() {
  return (
    <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden grain-bg">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/hero-background.svg"
          alt="Femme Events hero background"
          className="w-full h-full object-cover object-center"
        />
        {/* Stronger bottom gradient so info bar is always legible */}
        <div className="absolute inset-0 bg-gradient-to-b from-femme-plum/30 via-transparent to-femme-dark/75" />
      </div>

      {/* Main Title */}
      <div className="relative z-10 text-center px-4 flex flex-col items-center gap-5">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="text-[14vw] leading-[0.85] text-white uppercase drop-shadow-2xl"
        >
          Femme Events
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
          className="text-white/90 text-lg md:text-xl uppercase tracking-[0.3em] drop-shadow-md"
          style={{ fontFamily: "Balgin, serif" }}
        >
          Atlanta Wedding Partial Planning &amp; Design
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
          className="mt-2"
        >
          <ButtonCta
            label="Book a Consultation"
            onClick={() => document.getElementById("inquiry")?.scrollIntoView({ behavior: "smooth" })}
          />
        </motion.div>
      </div>

      {/* Bottom Info Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="absolute bottom-10 left-0 right-0 z-10 px-10 md:px-16 flex justify-between items-end text-white flex-wrap gap-6"
      >
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-widest opacity-75">Location</span>
          <span className="text-xl font-medium drop-shadow-md">Atlanta, GA</span>
        </div>
        <div className="flex flex-col gap-2 text-center">
          <span className="text-xs uppercase tracking-widest opacity-75">Email</span>
          <span className="text-xl font-medium drop-shadow-md">
            Amanda<span style={{ fontFamily: 'system-ui, sans-serif' }}>@</span>FemmeEvents.com
          </span>
        </div>
        <div className="flex flex-col gap-2 text-center">
          <span className="text-xs uppercase tracking-widest opacity-75">Instagram</span>
          <a
            href="https://www.instagram.com/_femmeevents/?hl=en"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xl font-medium drop-shadow-md hover:opacity-70 transition-opacity duration-200"
          >
            <span style={{ fontFamily: 'system-ui, sans-serif' }}>@_</span>femmeevents
          </a>
        </div>
        <div className="flex flex-col gap-2 text-right">
          <span className="text-xs uppercase tracking-widest opacity-75">Phone</span>
          <span className="text-xl font-medium drop-shadow-md" style={{ fontFamily: 'system-ui, sans-serif' }}>(678) 644-5257</span>
        </div>
      </motion.div>
    </section>
  );
}
