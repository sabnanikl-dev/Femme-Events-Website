/**
 * Activation gate for issue #161.
 *
 * Production measurement is hard-disabled in source. `VITE_GA4_MEASUREMENT_ID`
 * being present in the Vercel environment is deliberately NOT sufficient to
 * start collecting: turning measurement on is a separately approved change to
 * this file, performed under website #83 once its activation blockers
 * (Formspree/email/export retention, exact provider roles and permanent
 * ownership, provider-console settings, final public disclosure copy,
 * real-provider proof and an approved rollback) are resolved.
 *
 * To activate later, the approved change is:
 *   1. set `MEASUREMENT_ACTIVATION_APPROVED` to `true` in this file, in a PR
 *      that cites the #83 sign-off;
 *   2. leave `VITE_GA4_MEASUREMENT_ID` as the only env input — it selects the
 *      destination, it never enables collection on its own;
 *   3. separately flip `FORMSPREE_SOURCE_FIELDS_APPROVED` once the Formspree
 *      retention decision is recorded.
 * No Vercel environment edit alone can reach either path.
 */

/** Live GA4 loading. Approved only by an #83-cited change to this literal. */
export const MEASUREMENT_ACTIVATION_APPROVED: boolean = false;

/**
 * Whether `source`/`medium`/`campaign` may be added to a production Formspree
 * request. Blocked on the unresolved Formspree/forwarded-email retention
 * decision; the fixture path adds them to the intercepted local endpoint only.
 */
export const FORMSPREE_SOURCE_FIELDS_APPROVED: boolean = false;

/**
 * The exact opt-in token a local fixture build must set in
 * `VITE_MEASUREMENT_FIXTURE`. A production build never carries it: the fixture
 * path additionally requires the `measurement-fixture` Vite mode and a loopback
 * host, so an accidental production env value cannot reach it.
 */
export const FIXTURE_OPT_IN_TOKEN = "local-inert-fixture";

/** The Vite mode name reserved for the local, inert fixture build. */
export const FIXTURE_MODE_NAME = "measurement-fixture";

/** Hosts on which the fixture path may run. Loopback only. */
export const FIXTURE_ALLOWED_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "[::1]", "::1"];
