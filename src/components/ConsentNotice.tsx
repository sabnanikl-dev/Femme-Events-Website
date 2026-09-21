/**
 * Analytics consent notice (issue #161).
 *
 * A non-modal, JMD-inspired floating bottom notice rendered in Femme tokens and
 * Femme tone. It deliberately does not trap focus, steal initial focus, add a
 * backdrop or block the page: the site, the package cards and the inquiry form
 * stay fully usable while it is open, and Escape or Dismiss closes it without
 * granting anything.
 *
 * It renders only when the build is actually eligible to measure. Production is
 * hard-disabled (see lib/measurement/activation.ts), so this panel — and the
 * draft disclosure copy inside it, which is still pending owner review — does
 * not appear on the live site.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  closeConsentUi,
  isConsentUiOpen,
  isDismissed,
  measurement,
  subscribeConsentUi,
  takeInvoker,
} from "../lib/measurement/index.ts";
import type { ConsentStatus } from "../lib/measurement/index.ts";

type View = "notice" | "preferences" | "saved";

const actionBase =
  "inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-sm font-bold " +
  "font-system transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-femme-plum";

export default function ConsentNotice() {
  const [status, setStatus] = useState<ConsentStatus>(() => measurement.getStatus());
  const [uiOpen, setUiOpen] = useState(() => isConsentUiOpen());
  const [dismissed, setDismissed] = useState(() => isDismissed());
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const eligible = measurement.isEligible();

  useEffect(() => measurement.subscribe(() => setStatus(measurement.getStatus())), []);
  useEffect(
    () =>
      subscribeConsentUi(() => {
        setUiOpen(isConsentUiOpen());
        setDismissed(isDismissed());
      }),
    [],
  );

  // Opening from the footer control is a user-invoked interaction, so focus
  // moves to the panel and returns to the control when it closes. A first-visit
  // notice never steals focus.
  useEffect(() => {
    if (!uiOpen) return;
    setAnnouncement("");
    setSaveFailed(false);
    panelRef.current?.focus();
  }, [uiOpen]);

  const close = useCallback(
    (options: { dismissed?: boolean } = {}) => {
      const invoker = takeInvoker();
      closeConsentUi(options);
      setDetailsOpen(false);
      setAnnouncement("");
      setSaveFailed(false);
      invoker?.focus();
    },
    [],
  );

  const choose = useCallback(
    (choice: "granted" | "denied") => {
      const result = choice === "granted" ? measurement.grant() : measurement.deny();
      if (!result.ok) {
        // The preference could not be written. Say exactly what that does and
        // does not mean: a refusal still stops analytics in this tab, but we
        // cannot claim to have remembered it or updated any other tab.
        setSaveFailed(true);
        setAnnouncement(
          choice === "granted"
            ? "We could not save your choice in this browser, so analytics stays off. Check your browser storage settings and try again."
            : "Analytics is switched off in this tab. We could not save that choice in this browser, so other tabs you have open and your next visit may still have it on until you choose again.",
        );
        return;
      }
      setSaveFailed(false);
      setAnnouncement(
        choice === "granted"
          ? "Saved. Analytics is on. You can turn it off any time from Analytics preferences."
          : "Saved. Analytics stays off.",
      );
      takeInvoker()?.focus();
      closeConsentUi();
    },
    [],
  );

  if (!eligible) return null;

  const firstVisit = status === "undecided" && !dismissed;
  const visible = uiOpen || firstVisit || announcement !== "";
  if (!visible) return null;

  const view: View = uiOpen ? "preferences" : announcement !== "" && !saveFailed ? "saved" : "notice";
  const showChoices = view !== "saved" || saveFailed;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 sm:p-5" data-testid="consent-region">
      <div
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-labelledby="consent-notice-title"
        aria-describedby="consent-notice-description"
        data-testid="consent-panel"
        data-consent-view={view}
        onKeyDown={(event) => {
          // Escape closes without granting. Scoped to the panel so it never
          // hijacks Escape while the visitor is filling in the inquiry form.
          if (event.key !== "Escape") return;
          event.stopPropagation();
          close({ dismissed: true });
        }}
        /* The panel is bottom-anchored, so anything that grows past the
           viewport would push the title, the dismiss control and the choices
           off the top of the screen. Bounding its height and scrolling only the
           expanded disclosure keeps every control reachable at 320px, while the
           normal notice stays compact and never scrolls internally. */
        className="pointer-events-auto relative mx-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl
          flex-col rounded-2xl border border-femme-pink/70 bg-femme-cream/98 p-4 pr-14
          shadow-[0_18px_48px_rgba(36,15,21,0.22)] sm:max-h-[calc(100vh-2.5rem)] sm:p-6 sm:pr-16"
      >
        <button
          type="button"
          aria-label="Dismiss the analytics notice without choosing"
          onClick={() => close({ dismissed: true })}
          className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full
            text-femme-dark/60 transition-colors duration-200 hover:bg-femme-pink/25 hover:text-femme-dark
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-femme-plum"
        >
          <X size={18} strokeWidth={2} />
        </button>

        <div className="flex shrink-0 flex-col gap-4 md:flex-row md:items-center md:gap-8">
          <div className="min-w-0 flex-1">
            <h2 id="consent-notice-title" className="font-subheading text-lg leading-snug text-femme-dark">
              {view === "saved" ? "Thanks - that is saved" : "A quick note on analytics"}
            </h2>
            <p
              id="consent-notice-description"
              className="mt-1.5 text-sm leading-relaxed text-femme-dark/75 font-system"
            >
              {view === "saved"
                ? "You can change this any time from Analytics preferences in the footer."
                : "We would love to count a few basic things - which pages get visited and which packages people ask about - so we can make this site more useful. We never send your name, email, phone number or anything you type into the inquiry form."}
            </p>
            {view !== "saved" && (
              <button
                type="button"
                aria-expanded={detailsOpen}
                aria-controls="consent-notice-details"
                onClick={() => setDetailsOpen((open) => !open)}
                data-testid="consent-details-toggle"
                className="mt-1 inline-flex min-h-[44px] items-center text-sm font-system text-femme-plum
                  underline underline-offset-4 transition-colors duration-200 hover:text-femme-deep
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-femme-plum"
              >
                {detailsOpen ? "Hide privacy details" : "Privacy details"}
              </button>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:justify-end">
            {showChoices ? (
              <>
                <button
                  type="button"
                  data-testid="consent-allow"
                  onClick={() => choose("granted")}
                  className={actionBase + " bg-femme-plum text-white hover:bg-femme-deep"}
                >
                  Allow analytics
                </button>
                <button
                  type="button"
                  data-testid="consent-deny"
                  onClick={() => choose("denied")}
                  className={
                    actionBase + " border border-femme-plum/45 bg-transparent text-femme-plum hover:bg-femme-pink/25"
                  }
                >
                  No thanks
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="consent-close"
                onClick={() => close()}
                className={
                  actionBase + " border border-femme-plum/45 bg-transparent text-femme-plum hover:bg-femme-pink/25"
                }
              >
                Close
              </button>
            )}
          </div>
        </div>

        {detailsOpen && (
          <div
            id="consent-notice-details"
            data-testid="consent-details"
            /* Draft copy. Public publication is a separate owner-review gate;
               see docs/measurement-disclosure-draft.md. */
            data-disclosure-state="draft-pending-owner-review"
            /* `min-h-0` lets this flex child shrink so its own scrollbar takes
               the overflow, instead of the panel growing off-screen. */
            className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-femme-pink/50
              pt-4 text-sm leading-relaxed text-femme-dark/75 font-system"
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="font-bold text-femme-dark">What we would measure</dt>
                <dd>
                  A page category for each page you open, clicks on our inquiry buttons, clicks on the footer phone
                  and email links, and inquiry forms that the form provider accepts.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-femme-dark">What we never send</dt>
                <dd>
                  Your name, email address, phone number, event date, venue, guest count or message. No full web
                  address, no search terms, and not the site you arrived from.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-femme-dark">Who processes it</dt>
                <dd>
                  Google Analytics 4, run by Google. It sets cookies in this browser that identify the browser
                  session, not you by name.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-femme-dark">How long</dt>
                <dd>
                  Your choice is kept in this browser for six months. Google Analytics cookies are set to last for
                  the browser session. Your inquiry itself is handled separately by our form provider and by email.
                </dd>
              </div>
            </dl>
            <p className="mt-3">
              Saying no thanks changes nothing else: browsing, choosing a package and sending an inquiry all work
              exactly the same.
            </p>
          </div>
        )}

        <p
          role="status"
          aria-live="polite"
          data-testid="consent-status"
          className={
            announcement === ""
              ? "sr-only"
              : saveFailed
                ? "mt-3 shrink-0 text-sm font-system text-femme-deep"
                : "mt-3 shrink-0 text-sm font-system text-femme-dark/70"
          }
        >
          {announcement}
        </p>
      </div>
    </div>
  );
}
