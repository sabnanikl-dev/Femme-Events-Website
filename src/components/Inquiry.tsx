import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const labelClass = "text-xs uppercase tracking-widest font-bold opacity-60 font-system";
const inputClass =
  "bg-transparent border border-femme-dark/30 px-4 py-3 text-base focus:border-femme-dark outline-none transition-colors duration-200 font-system";

const FORM_ACTION = import.meta.env.VITE_FORMSPREE_ENDPOINT || "";

type SubmitState = "idle" | "loading" | "success" | "error";

export default function Inquiry() {
  const [hasVenue, setHasVenue] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!FORM_ACTION) {
      setState("error");
      setErrorMsg("Form backend not configured. Contact site admin.");
      return;
    }

    setState("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value as string;
    });

    try {
      const res = await fetch(FORM_ACTION, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setState("success");
        form.reset();
      } else {
        throw new Error(`Server responded with ${res.status}`);
      }
    } catch (err) {
      setState("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Something went wrong. Try again or email us directly."
      );
    }
  }

  const submitting = state === "loading";

  /* ──────────── Success state ──────────── */
  if (state === "success") {
    return (
      <section id="inquiry" className="py-24 px-6 md:px-24 bg-femme-lavender grid md:grid-cols-2 gap-16 items-center">
        <div className="flex flex-col gap-6">
          <h2 className="text-6xl md:text-8xl text-femme-dark leading-[0.95] italic">
            Ready to Chat Dates &amp; Dreams?
          </h2>
          <p className="text-femme-dark/70 text-xl font-system">
            Drop us a line and let&apos;s see if your calendar and our magic align.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center justify-center text-center gap-6 py-16 px-8 bg-femme-cream/80 rounded-2xl border border-femme-pink/30"
        >
          <CheckCircle2 size={56} className="text-femme-plum" strokeWidth={1.5} />
          <h3 className="text-4xl text-femme-dark font-display">You&apos;re In!</h3>
          <p className="text-femme-dark/60 text-lg font-system max-w-md">
            We&apos;ll review your inquiry and get back to you within 24 hours. 
            Check your inbox (and spam) for our reply.
          </p>
        </motion.div>
      </section>
    );
  }

  /* ──────────── Normal form ──────────── */
  return (
    <section id="inquiry" className="py-24 px-6 md:px-24 bg-femme-lavender grid md:grid-cols-2 gap-16">
      <div className="flex flex-col gap-6">
        <h2 className="text-6xl md:text-8xl text-femme-dark leading-[0.95] italic">
          Ready to Chat Dates &amp; Dreams?
        </h2>
        <p className="text-femme-dark/70 text-xl font-system">
          Drop us a line and let&apos;s see if your calendar and our magic align.
        </p>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {state === "error" && (
          <div className="flex items-start gap-3 p-4 rounded-lg border bg-red-50 border-red-200 text-red-700">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm font-system">{errorMsg}</p>
          </div>
        )}

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="firstName" className={labelClass}>First Name</label>
            <input id="firstName" name="firstName" type="text" required className={inputClass} disabled={submitting} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="lastName" className={labelClass}>Last Name</label>
            <input id="lastName" name="lastName" type="text" required className={inputClass} disabled={submitting} />
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" name="email" type="email" required className={inputClass} disabled={submitting} />
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
              disabled={submitting}
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
              disabled={submitting}
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
                disabled={submitting}
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
                    disabled={submitting}
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
            disabled={submitting}
          />
        </div>

        <motion.button
          type="submit"
          whileHover={submitting ? {} : { scale: 1.02 }}
          whileTap={submitting ? {} : { scale: 0.98 }}
          disabled={submitting}
          className={`py-4 text-base font-bold shadow-lg mt-2 cursor-pointer rounded-full font-system flex items-center justify-center gap-2 transition-colors duration-200 ${
            submitting
              ? "bg-femme-dark/60 text-white/80 cursor-not-allowed"
              : "bg-femme-plum text-white hover:bg-femme-dark"
          }`}
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {submitting ? "Sending..." : "Send Inquiry"}
        </motion.button>
      </motion.form>
    </section>
  );
}
