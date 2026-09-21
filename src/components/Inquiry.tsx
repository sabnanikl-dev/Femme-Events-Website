import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import SafeText from "./SafeText";
import { SERVICE_OPTIONS, NOT_SURE_LABEL, labelForSlug } from "../data/serviceOptions";
import {
  createInquirySubmitter,
  decideSourceFields,
  inquiryErrorMessage,
  measurement,
  slugForLabel,
} from "../lib/measurement/index.ts";

const labelClass = "text-xs uppercase tracking-widest font-bold opacity-60 font-system";
const inputClass =
  "bg-transparent border border-femme-dark/30 px-4 py-3 text-base focus:border-femme-dark outline-none transition-colors duration-200 font-system";

const FORM_ACTION = import.meta.env.VITE_FORMSPREE_ENDPOINT || "";

type SubmitState = "idle" | "loading" | "success" | "error";

export default function Inquiry() {
  const location = useLocation();
  const [hasVenue, setHasVenue] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Prefilled from `?service=<slug>` when a visitor clicks a Services card;
  // defaults to "Not sure yet" for anyone who reaches the form directly.
  const [selectedService, setSelectedService] = useState(
    () => labelForSlug(new URLSearchParams(location.search).get("service")) || NOT_SURE_LABEL,
  );

  // Keep the dropdown mirroring the URL's ?service= param across every SPA
  // navigation: clicking a different package's "Book Now", and also Back/Forward
  // or an invalid/removed slug — both reset to the neutral fallback so the form
  // never shows a stale package the URL no longer reflects.
  useEffect(() => {
    const label = labelForSlug(new URLSearchParams(location.search).get("service"));
    setSelectedService(label || NOT_SURE_LABEL);
  }, [location.search]);

  // One submitter per mounted form. It owns the synchronous in-flight latch,
  // the 15s timeout/abort and the one-outcome-per-operation guarantee, so a
  // re-render can never start or settle a second POST (issue #161).
  const submitter = useMemo(
    () => createInquirySubmitter({ endpoint: FORM_ACTION, fetchImpl: (input, init) => fetch(input, init) }),
    [],
  );
  const submittingRef = useRef(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!FORM_ACTION) {
      setState("error");
      setErrorMsg("Form backend not configured. Contact site admin.");
      return;
    }

    // Synchronous guard, before any await: rapid submit/Enter/callback paths
    // all bounce off this rather than queueing a duplicate request.
    if (submittingRef.current || submitter.isInFlight()) return;
    submittingRef.current = true;

    const form = e.currentTarget;
    // Snapshot the request while every control is still enabled. Disabling the
    // fields during submission must not be able to drop a value, and the source
    // attached here is the submission-time snapshot, never a later one.
    const formData = new FormData(form);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value as string;
    });
    const serviceSlug = slugForLabel(selectedService);
    const sourceSnapshot = measurement.snapshotSource();
    // Production source fields stay blocked on the separate Formspree retention
    // decision (website #83): `FORMSPREE_SOURCE_FIELDS_APPROVED` is hard-false,
    // so the only path that adds them is the local fixture mode pointed at a
    // provably inert endpoint. Nothing is appended retroactively after
    // acceptance - this is the submission-time snapshot.
    const sourceFields = decideSourceFields(measurement.getConfig().mode, FORM_ACTION);
    if (sourceSnapshot && sourceFields.allowed) {
      data.source = sourceSnapshot.source;
      data.medium = sourceSnapshot.medium;
      data.campaign = sourceSnapshot.campaign;
    }

    setState("loading");
    setErrorMsg("");

    const outcome = await submitter.submit(data);
    // A duplicate never owned the latch, so it must not release it either.
    if (outcome.status === "duplicate") return;
    submittingRef.current = false;

    if (outcome.status !== "accepted") {
      // Validation failure, non-2xx, network error and timeout all emit zero
      // success events and leave every entry in place for a retry.
      setState("error");
      setErrorMsg(inquiryErrorMessage(outcome));
      return;
    }

    form.reset();
    setState("success");
    // Backend acceptance controls the success UI. Analytics is rechecked
    // against consent separately and can never block or undo the confirmation.
    try {
      measurement.trackInquirySuccess(outcome.operationId, serviceSlug, sourceSnapshot);
    } catch {
      // A tracking failure must never turn an accepted inquiry into an error.
    }
  }

  const submitting = state === "loading";

  /* ──────────── Success state ──────────── */
  if (state === "success") {
    return (
      <section id="inquiry" className="py-16 md:py-24 px-6 md:px-24 bg-femme-lavender grid md:grid-cols-2 gap-16 items-center">
        <div className="flex flex-col gap-6">
          <h2 className="text-6xl md:text-8xl text-femme-dark leading-[0.95] italic">
            <SafeText text="Ready to Chat Dates and Dreams?" />
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
          <h3 className="text-4xl text-femme-dark font-display">
            <SafeText text="You're In!" />
          </h3>
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
    <section id="inquiry" className="bg-femme-lavender px-6 py-16 md:px-16 md:py-24 lg:px-24">
      {/* Audience / differentiator — confidence block before the form (Issue #87) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.8fr)] lg:items-center"
      >
        <div className="flex flex-col gap-7">
          <p className="text-3xl italic leading-tight text-femme-dark font-display md:text-5xl">
            <SafeText text="You belong here if you want the wedding to feel like you, not like a checklist someone handed you." />
          </p>
          <p className="text-base leading-relaxed text-femme-dark/70 font-system md:text-lg">
            Bring us the disco balls, the bows, the moody florals, the dramatic
            dress change, the sentimental ceremony, the different little detail
            nobody else understands, the hyper-feminine fantasy, the alternative
            mood board, the silly inside joke, the “is this too much?” idea.
          </p>
          <p className="text-2xl italic text-femme-plum font-display md:text-3xl">
            <SafeText text="It is not too much. It is the point." />
          </p>
        </div>

        <figure className="aspect-[16/11] overflow-hidden rounded-lg bg-femme-pale shadow-[0_22px_55px_rgba(36,15,21,0.16)]">
          <img
            src="/photos/inquirybrand.JPG"
            alt="Femme Events brand details with a disco ball, flowers, and heart cake"
            className="h-full w-full object-cover object-[50%_48%]"
            loading="lazy"
            decoding="async"
          />
        </figure>
      </motion.div>

      <div className="mx-auto mt-16 grid max-w-6xl gap-12 md:grid-cols-[minmax(0,0.82fr)_minmax(420px,1fr)] md:items-start">
        <div id="inquiry-form" className="scroll-mt-28 flex flex-col gap-6 md:sticky md:top-32">
          <h2 className="text-6xl italic leading-[0.95] text-femme-dark md:text-8xl">
            <SafeText text="Ready to Chat Dates and Dreams?" />
          </h2>
          <p className="text-xl text-femme-dark/70 font-system">
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

        {/* Phone — sent to Formspree as `phone`; intentionally no strict pattern
            so common domestic and international formats are all accepted (#157). */}
        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className={labelClass}>Phone Number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            className={inputClass}
            disabled={submitting}
          />
        </div>

        {/* Interested Service — prefilled from the clicked Services card (#95),
            editable here, and sent to Formspree as `interestedService`. */}
        <div className="flex flex-col gap-2">
          <label htmlFor="interestedService" className={labelClass}>Interested Service</label>
          <select
            id="interestedService"
            name="interestedService"
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className={inputClass}
            disabled={submitting}
          >
            {SERVICE_OPTIONS.map((option) => (
              <option key={option.slug} value={option.label}>
                {option.label}
              </option>
            ))}
            <option value={NOT_SURE_LABEL}>{NOT_SURE_LABEL}</option>
          </select>
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
      </div>
    </section>
  );
}
