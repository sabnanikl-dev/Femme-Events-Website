import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const labelClass = "text-xs uppercase tracking-widest font-bold opacity-60 font-system";
const inputClass =
  "bg-transparent border border-femme-dark/30 px-4 py-3 text-base focus:border-femme-dark outline-none transition-colors duration-200 font-system";

export default function Inquiry() {
  const [hasVenue, setHasVenue] = useState(false);

  return (
    <section id="inquiry" className="py-24 px-6 md:px-24 bg-femme-lavender grid md:grid-cols-2 gap-16">
      <div className="flex flex-col gap-6">
        <h2 className="text-6xl md:text-8xl text-femme-dark leading-[0.95] italic">
          Ready to Chat Dates &amp; Dreams?
        </h2>
        <p className="text-femme-dark/70 text-xl font-system">
          Drop us a line and let's see if your calendar and our magic align.
        </p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col gap-5"
      >
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="firstName" className={labelClass}>First Name</label>
            <input id="firstName" name="firstName" type="text" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="lastName" className={labelClass}>Last Name</label>
            <input id="lastName" name="lastName" type="text" required className={inputClass} />
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" name="email" type="email" required className={inputClass} />
        </div>

        {/* Event Date + Guest Count */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="eventDate" className={labelClass}>Event Date</label>
            <input
              id="eventDate"
              name="eventDate"
              type="date"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="guestCount" className={labelClass}>Estimated Guest Count</label>
            <input
              id="guestCount"
              name="guestCount"
              type="number"
              min="1"
              placeholder="e.g. 120"
              className={inputClass}
            />
          </div>
        </div>

        {/* Venue Checkbox */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <div className="relative">
              <input
                id="hasVenue"
                name="hasVenue"
                type="checkbox"
                checked={hasVenue}
                onChange={(e) => setHasVenue(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 border-2 flex items-center justify-center transition-colors duration-200 ${
                  hasVenue ? "bg-femme-plum border-femme-plum" : "bg-transparent border-femme-dark/40"
                }`}
              >
                {hasVenue && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm uppercase tracking-widest font-bold opacity-60 font-system">
              I already have a venue
            </span>
          </label>

          {/* Venue Name — slides in when checked */}
          <AnimatePresence>
            {hasVenue && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2 pt-1">
                  <label htmlFor="venueName" className={labelClass}>Venue Name</label>
                  <input
                    id="venueName"
                    name="venueName"
                    type="text"
                    placeholder="e.g. The Estate at Cherokee Dock"
                    className={inputClass}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Message */}
        <div className="flex flex-col gap-2">
          <label htmlFor="message" className={labelClass}>Message</label>
          <textarea
            id="message"
            name="message"
            rows={4}
            required
            className={`${inputClass} resize-none`}
          />
        </div>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-femme-plum text-white py-4 text-base font-bold shadow-lg hover:bg-femme-dark transition-colors duration-200 mt-2 cursor-pointer"
        >
          Send Inquiry
        </motion.button>
      </motion.form>
    </section>
  );
}
