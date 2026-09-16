import { trackEvent } from "../lib/analytics";
import { measurement, openConsentUi } from "../lib/measurement/index.ts";

export default function Footer() {
  return (
    <footer className="py-10 px-6 md:px-24 bg-femme-pale border-t border-femme-plum/10">
      <div className="grid md:grid-cols-3 gap-10 items-center">
        <div className="flex flex-col gap-2">
          <img
            src="/logo-footer.svg"
            alt="Femme Events"
            loading="lazy"
            decoding="async"
            className="h-24 w-auto object-contain object-left"
          />
          <p className="text-sm opacity-60 font-system">Made with love in Atlanta.</p>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm uppercase tracking-[0.2em] font-bold opacity-40">Location</h4>
          <p className="text-base text-femme-dark/80">Atlanta, GA</p>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm uppercase tracking-[0.2em] font-bold opacity-40">Contact</h4>
          <div className="text-base leading-relaxed font-system">
            <a
              href="mailto:amanda@femmeevents.com"
              onClick={() => trackEvent("email_click", { location: "footer" })}
              className="hover:text-femme-plum transition-colors duration-200 block"
            >
              amanda@femmeevents.com
            </a>
            <a
              href="tel:6786445257"
              onClick={() => trackEvent("phone_click", { location: "footer" })}
              className="hover:text-femme-plum transition-colors duration-200 block mt-1"
            >
              (678) 644-5257
            </a>
            <a
              href="https://instagram.com/_femmeevents"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("instagram_click", { location: "footer" })}
              className="hover:text-femme-plum transition-colors duration-200 block mt-1"
            >
              @_femmeevents
            </a>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-femme-plum/5 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-widest font-bold font-system">
        <span className="opacity-30">&copy; 2026 Femme Events</span>
        {/* Persistent way back to the analytics choice (issue #161). Rendered
            only when the build is actually eligible to measure, so the live,
            hard-disabled build shows no control for something it never does. */}
        {measurement.isEligible() && (
          <button
            type="button"
            data-testid="footer-analytics-preferences"
            onClick={(event) => openConsentUi(event.currentTarget)}
            className="inline-flex min-h-[44px] items-center text-femme-dark/60 underline underline-offset-4
              transition-colors duration-200 hover:text-femme-plum focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-femme-plum"
          >
            Analytics preferences
          </button>
        )}
        <span className="opacity-30">All Rights Reserved</span>
      </div>
    </footer>
  );
}
