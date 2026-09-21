# Measurement (issues #15, #161)

Consent-gated Google Analytics 4 for the Femme Events site, built to the
approved **FEMME-GA4-v1** measurement policy. This document describes what the
repository does. It is not an activation guide: **production is hard-disabled in
source** and cannot be switched on by setting an environment variable.

Activation, provider-console settings, real-provider proof and rollback belong
to [website #83](https://github.com/sabnanikl-dev/Femme-Events-Website/issues/83).
Policy decisions belong to PAPI-74.

---

## 1. What is on, and what it takes to turn it on

| Layer | Where | Current value |
|---|---|---|
| Production activation | `src/lib/measurement/activation.ts` → `MEASUREMENT_ACTIVATION_APPROVED` | `false` |
| Formspree `source`/`medium`/`campaign` fields | `activation.ts` → `FORMSPREE_SOURCE_FIELDS_APPROVED` | `false` |
| Destination id | `VITE_GA4_MEASUREMENT_ID` | selects *where*, never *whether* |

`resolveMeasurementConfig()` returns one of three modes, and every branch that is
not an explicit, fully-satisfied approval returns `disabled`:

- **`disabled`** — no tag, no storage, no cookies, no consent UI, no collection.
  This is what a production build does today, including when a valid
  `VITE_GA4_MEASUREMENT_ID` is present in the environment.
- **`fixture`** — the local, inert test path. Requires **all three** of: Vite
  mode `measurement-fixture`, `VITE_MEASUREMENT_FIXTURE=local-inert-fixture`,
  and a loopback hostname. A production deployment cannot satisfy these.
- **`live`** — unreachable until `MEASUREMENT_ACTIVATION_APPROVED` is changed to
  `true` in a PR that cites the #83 sign-off.

Also inert: no measurement id, a malformed id, any Plausible variable being set
(`conflicting-provider-config`), and any combination of the above. There is no
Plausible fallback and no "configure it and it starts working" path.

A syntactically valid id is not proof the destination is correct. Confirming the
account/property/stream is a #83 check.

## 2. Consent contract

- **Before an explicit grant:** no tag request, no collection request, no
  analytics cookie, no `dataLayer`, no preference record.
- **On refusal:** the same, plus no denied-state cookieless pings. That holds
  because the tag is never asked to load at all, not because a denied consent
  signal silences a loaded tag — see the consent-mode note below.
- **Ads signals** (`ad_storage`, `ad_user_data`, `ad_personalization`) are denied
  in the consent default and in every later update. `allow_google_signals` and
  `allow_ad_personalization_signals` are `false`.
- **Preference record** (`localStorage`, key `femme.analytics.consent.v1`):
  exactly `{v, policy, choice, exp}` — choice, policy version and a six-month
  expiry. No marketing tuple, no identifier, no form data. Unreadable, invalid,
  version-mismatched or expired storage reads as *undecided*, which is inert. A
  write that fails is **not** a decision: the panel stays open and analytics
  stays off.
- **Validity is re-checked, not cached.** The stored preference is re-read
  before every emission, on every navigation, at document lifecycle boundaries
  (`pageshow`, `focus`, `resume`, `pagehide`, `freeze`, `visibilitychange` in
  both directions), and on a teardown timer armed for the expiry instant. A
  six-month preference is roughly seven times longer than a single `setTimeout`
  can represent, and an out-of-range delay fires almost immediately rather than
  later, so the wait is **chained** in hops of at most the representable maximum;
  each hop only re-checks the deadline and arms the next one. It is a deadline,
  not a heartbeat — no hop sends, refreshes or records anything. This is what
  stops an idle background tab that is never navigated, focused or clicked from
  collecting past expiry. The lifecycle and before-emission checks remain,
  because a throttled or frozen document cannot be trusted to fire a timer on
  time, and a timer cannot be trusted to have fired at all. An expired,
  unreadable, cleared or version-mismatched record therefore tears a *still-open*
  document down instead of letting a cached "granted" keep collecting.
- **A late tag load is re-checked too.** The load callback re-validates the
  preference before the tag is treated as live, so a script that finally arrives
  after the grant lapsed or was withdrawn is torn down instead. What that
  callback cannot do is recall the backlog: a script executes, drains whatever is
  already queued and only then fires its load event. Dropping the queue before
  load is the teardown path's job (`ga-disable` plus the queue splice), and that
  is what the focused tests assert.
- **A failed write still stops this document.** Refusal and withdrawal take
  effect in the current document whether or not the preference could be saved;
  the call reports `ok: false` and the UI says plainly that the choice was not
  remembered and that other tabs and the next visit are unaffected. Both kinds of
  unsaved choice are **latched in memory** for the life of the document, because
  the earlier record is usually still perfectly readable and every consent
  re-check would otherwise restore it at the next navigation, focus event or
  click. A refusal latches as *denied*; a grant that could not be saved is not a
  decision at all, so it latches as *undecided* — the panel stays open, the
  earlier granted session is stopped, and nothing re-enables until a **new**
  explicit choice is written successfully. The latch is deliberately not
  persisted: we cannot claim to have updated other documents.
- **Init is idempotent.** React StrictMode double-invokes effects; a repeated
  init or a repeated grant does not load or count twice.
- **No replay.** Clicks and submissions made before a grant are dropped, never
  queued. Granting counts the current page once; it never backfills history.

### Withdrawal — layered, and deliberately reload-free

Withdrawal must stop collection *and* preserve an in-progress inquiry. Every text
field in `Inquiry.tsx` is an uncontrolled DOM input, so any path that reloads or
unmounts the form loses the visitor's entries. Withdrawal therefore tears down in
place, in this order:

1. **Wrapper** — the runtime stops emitting, invalidates the load generation so a
   late `onLoad` cannot revive anything, drops its own queued `dataLayer`
   entries and removes the injected script node.
2. **Documented opt-out** — `window['ga-disable-<MEASUREMENT_ID>'] = true`.
   Google's tag-platform privacy guide (page last updated 2026-07-30) documents
   this property as checked before the tag sets a cookie or sends data. It is
   load-order tolerant, which also covers withdrawing while a load is in flight.
3. **Consent update** — analytics and all ads signals denied. This is a
   *complement*, never a substitute (see below).

**Consent mode, stated precisely.** In **advanced** consent mode the tag loads
before the visitor chooses and keeps sending cookieless pings while consent is
denied — which the approved policy forbids. In **basic** consent mode the tag is
not requested until consent is granted, so a refusal pings nothing. This build is
basic-shaped: no tag request before an explicit grant. The consequence for
withdrawal is the important part: once the tag *has* loaded, moving consent to
denied is not a stop signal, so a denied consent state is never relied on by
itself. Layer 2 carries the no-collection requirement after load.

Then: only the inventoried GA4 cookies are deleted (`_ga` and
`_ga_<container>`, matching host and parent domains, path `/`) — unrelated
application cookies and storage are never touched; the session source record is
cleared and the in-memory arrival bookkeeping is burnt; and the six-month
preference record is updated, which
fires `storage` in every other open same-origin document so each one runs the
same in-place teardown. Peers are never reloaded either, because a peer tab may
also hold a half-written inquiry.

**Limits, stated plainly.** Layers 1–3 stop transmission; they do not evict
already-loaded Google code from a page it already has full privileges on. The
next ordinary navigation or reload yields a clean document that never loads the
tag. Payloads already sent cannot be recalled. Consent synchronisation across
tabs is *not* source attribution synchronisation — attribution stays same-tab.

## 3. Approved events

Nothing reaches the provider without passing `validateEvent()`. An unknown event
name, an unexpected key, a missing required key or an unlisted value rejects the
payload **as a whole**, and rejected payloads are never logged. The UI action
itself always proceeds.

| Event | Required | Optional |
|---|---|---|
| `page_view` | controlled route label (see below) | — |
| `cta_inquiry_click` | `location` ∈ `hero`, `service_card`, `process`, `vendors`, `faq` | `service` (canonical slug, `service_card` only) |
| `phone_click` | `location=footer` | — |
| `email_click` | `location=footer` | — |
| `inquiry_submit` | `location=inquiry_form`, `service` ∈ canonical slugs or `not-sure` | — |

`source=google`, `medium=organic`, `campaign=gbp` may ride any eligible event,
but only all three together and only from validated, consent-approved source
state. **Callers cannot inject them** — a caller-supplied `source` key rejects
the whole payload.

Out of scope in this slice, and therefore *not collected*: `nav_inquiry_click`,
`instagram_click`, `vendor_link_click`. Those callsites still navigate normally;
their events are simply dropped by the allowlist. Adding a new callsite does not
widen collection — a new event needs a policy decision and an explicit entry in
`src/lib/measurement/schema.ts`.

### Controlled provider context

Configured before the tag can emit, refreshed on navigation, **and attached to
every payload** — pageviews and custom events alike, so a `phone_click` reports
the route category of the page it happened on rather than inheriting whatever
page context the provider still held. The safe values are applied last when the
payload is assembled, so even a caller that somehow supplied `page_location`,
`page_title` or `page_referrer` cannot override them:

- `page_location` = `https://femmeevents.com` + a **route category**: `/`,
  `/about`, `/what-happens-next`, `/journal`, `/journal/post`, or `/other`.
- `page_title` = the static string `Femme Events`.
- `page_referrer` = empty.

Never sent: the real URL, query string or fragment; CMS slugs or titles;
`document.title`; link text; form fields; the raw referrer; User-ID; user
properties. Wrapper parameters are distinct from transport headers and from
unavoidable GA4 protocol/lifecycle fields, which this repository cannot control
and which are inventoried under #83.

`send_page_view: false` disables the tag's initial automatic pageview. The
configurable Enhanced Measurement collectors (form interactions, outbound link
clicks, history-change pageviews) are **console-side settings**: #83 must set and
verify them. A local fake tag cannot prove live provider behaviour.

## 4. Source attribution — GBP only, same tab

Only the complete, exactly decoded tuple
`utm_source=google&utm_medium=organic&utm_campaign=gbp` is recognised. Rejected
(and treated as *unsupported* input, which clears any prior GBP state rather
than being relabelled): duplicate keys even with identical values, mixed-case
keys or values, a missing member, any other `utm_*` field, any click identifier
(`gclid`, `gbraid`, `wbraid`, `fbclid`, `_gl`, …), invalid percent encoding, a
decoded value over 64 characters, and a search string over 2,048 characters.
Values are decoded exactly once and never trimmed or repaired.

Unrelated query fields (for example `?service=the-full-femme`) coexist, are
ignored, and are never persisted, logged or transmitted. Existing `?service=`
preselection and fragment navigation are untouched.

Three pieces of state, and no durable marketing identifier anywhere:

| State | Where | Lifetime |
|---|---|---|
| Candidate (undecided visitor) | volatile memory only | 30-minute idle |
| Granted record | `sessionStorage` `femme.analytics.source.v1` | 30-minute idle |
| Arrival bookkeeping | volatile memory only | document lifetime |

**Nothing at all is written to session storage before an explicit grant, and a
refusal writes nothing.** Arrival bookkeeping is source-derived state, so it is
held in memory and never persisted; the granted record above is the only
measurement key session storage ever holds.

Expiry is inclusive: at exactly the boundary the record is cleared before use or
refresh. Only real navigation and user actions refresh the idle window — there is
no background heartbeat.

The 30-minute boundary also has its **own teardown deadline**, armed on capture
and re-armed on each activity refresh. Checking expiry only when something
happens to read the record is not the same as expiring it: a document that is
granted, attributed and then simply left alone would otherwise keep its provider
campaign context, and provider-originated traffic would go on carrying it. When
the deadline falls due the stored record is cleared and the provider campaign is
explicitly purged. It is a deadline, not a heartbeat — no hop reads for the sake
of reading, sends anything or extends the window. Because a throttled, frozen or
restored document cannot be trusted to have fired its timer at all, the source
deadline is also re-checked (never refreshed) at every lifecycle checkpoint,
before anything can use the record.

Future timestamps, wrong versions and corrupt records fail closed and are
cleared. So does a record that names a different grant — see below.

### The arrival-consumption mechanism

Arrival bookkeeping holds two integers and no campaign values: `seq`, how many
source-bearing arrivals this document has seen, and `consumed`, the highest
arrival already resolved. A candidate is promotable only while `seq > consumed`.

- A **reload** or a **back/forward** document navigation is not an arrival:
  `performance.getEntriesByType("navigation")[0].type` gates capture, so the URL
  is never re-read for attribution. An in-app `POP` navigation is likewise never
  an arrival — but it *is* still classified, so Back to a **different**
  campaign fails closed and clears the earlier GBP state rather than silently
  keeping it.
- **Refusal or withdrawal** sets `consumed = seq`, burning every arrival the
  document knows about, and clears the stored record.
- Therefore a later **re-grant**, a reload of the tagged URL, or Back to the
  original tagged entry all find nothing eligible. Only a genuinely new forward
  navigation carrying the approved tuple raises `seq` again.

### Cleanup that can be stood behind

`sessionStorage` can refuse `removeItem` on its own while reads and writes still
work, and a cleanup that was merely attempted is not a cleanup. Clearing the
source record is therefore verified, and reports one of three outcomes:

| Outcome | What happened |
|---|---|
| `removed` | the key is provably gone |
| `neutralised` | removal refused, so the record was overwritten with a value that cannot read back as attribution; no campaign values remain |
| `failed` | neither worked, or the result could not be verified |

A `failed` clear latches distrust: stored source is not read at all for the rest
of that document. Across a document boundary the guarantee is carried by the
record itself. Each stored record names **which grant it belongs to**, using
that grant's expiry instant — a value the necessary preference already holds, so
the approved consent record is not widened and nothing new is learned about the
visitor. A withdrawal followed by a re-grant produces a different expiry, so a
record left behind by a refused removal is not the new grant's attribution and
is dropped.

On top of both: **a grant only ever adopts attribution it has just written
itself.** Whatever is already in session storage when a new choice is made
belongs to an earlier grant, and a new choice is not the moment to start
trusting it. Restoring a valid record on a same-tab reload under an unchanged
grant is the one supported case, and it goes through initialisation, not
through a grant.

### Initialising without a grant

At initialisation, if effective consent is anything other than a grant —
undecided, refused, expired, version-mismatched, unreadable, or withdrawn in
another document — any stored source record is burnt before anything can read
or refresh it. Activity refresh likewise never reads or rewrites a persisted
marketing record outside granted status. Only a genuinely new arrival captured
in that document survives an undecided state, and it survives in memory.

Limits: source continuity is same-tab only. Some browsers copy `sessionStorage`
into a tab opened from a link, and some restore a session after a crash or
reopen — expiry and consent still apply, but continuity across tabs is not
promised and is never actively replicated. On a browser without Navigation
Timing this fails closed (no attribution) rather than guessing.

## 5. Inquiry lifecycle

- The selected package and the valid source are **snapshotted when the request is
  formed**, before any control is disabled. Attribution is never appended
  retroactively after acceptance.
- A **synchronous in-flight latch** (set before any `await`) means rapid
  submit/Enter/callback paths and re-renders cannot start a second POST.
- **15-second timeout** with `AbortController`. A response that arrives after the
  abort belongs to an abandoned operation and is ignored. A timed-out request may
  still have reached the server: nothing auto-retries, and no exactly-once
  backend delivery is claimed.
- Validation failure, non-2xx, network error and timeout emit **zero** success
  events and leave every entry in place. Retrying after a settled failure is
  allowed and produces a new operation with its own single success event.
- On acceptance, consent is rechecked. Source rides the success event only if the
  attribution the request was formed with is still the current, unexpired one. If
  it expired → omitted. If a different campaign was captured mid-request →
  omitted, never substituted. If consent was withdrawn → no event at all. In the
  omitted cases the inherited page campaign is also cleared **for that one
  event** (see §8), so dropping the fields is not quietly undone by `config`
  inheritance.
- **Backend acceptance controls the success UI.** Denied consent, a blocked tag
  or an analytics error can never prevent or undo an accepted inquiry.
- `source`/`medium`/`campaign` are added to the request only when
  `decideSourceFields()` allows it (`src/lib/measurement/formSource.ts`). It has
  two independent gates:
  1. `FORMSPREE_SOURCE_FIELDS_APPROVED` — the production answer, hard-`false` in
     source pending the Formspree/forwarded-email/export retention decision;
  2. the local fixture path — measurement mode `fixture` (already loopback-only,
     Vite-mode-gated and token-gated) **and** an endpoint that cannot deliver
     anywhere: same-origin relative, a loopback host, or a reserved `.invalid`
     host (RFC 6761, never resolvable), which the browser fixtures intercept
     before navigation.

  A fixture build pointed at a real endpoint is refused, and no environment value
  can reach either gate. Production therefore sends no attribution field.

## 6. Retention — separate answers, not one number

| Thing | Retention | Status |
|---|---|---|
| Consent preference | six months (183 days) | implemented |
| Website source attribution | 30-minute idle expiry | implemented |
| GA4 cookies | session-based (`cookie_expires: 0`) | implemented; browsers may restore a session |
| GA4 user/event-level data | two months, reset-on-new-activity **off** | **#83 must set and verify in the console** |
| Formspree records, forwarded email, exports | **unresolved** | activation blocker; no number invented here |

Two-month GA4 user/event retention does **not** erase all standard aggregated
reports.

## 7. Commands

```bash
npm run lint              # tsc --noEmit, now also covering tests/
npm run build             # production build (measurement disabled)
npm run verify:seo        # static SEO asset verification
npm run test:measurement  # focused logic tests (Node's test runner, no browser)
npm run test:measurement:browser   # Playwright fixtures, loopback only
```

`npm run test:measurement` runs `tests/measurement/**/*.test.ts` against a fake
clock, fake storage, fake cookie jar, fake fetch and an inert modelled tag.
Timers are opt-in (`setupHarness({ fakeTimers: true })`): with them installed,
`env.advance()` both moves the clock and *runs* the timers that come due,
including ones armed by a timer that already fired. That is what lets the
six-month expiry be tested as a genuinely idle document — advancing `Date.now()`
alone would prove nothing about code waiting on `setTimeout`. It includes
negative controls: each contract suite is also run against a deliberately
weakened mutant — including the actual pre-#161 analytics behaviour, a scheduler
that skips out-of-range delays, and an adapter with no event-scoped campaign
control — and must fail there.

`npm run test:measurement:browser` starts three loopback servers, and they are
three different classes of evidence — worth keeping apart:

| Server | Port | What it is | What it supports |
|---|---|---|---|
| `dev:measurement-fixture` | 4317 | Vite **dev** server, `measurement-fixture` mode | the whole consent/source/inquiry fixture matrix |
| `dev:measurement-ambient-check` | 4318 | Vite **dev** server, `--mode production`, ambient `VITE_GA4_MEASUREMENT_ID` | the activation gate through the dev pipeline |
| `build:` + `preview:measurement-ambient-check` | 4319 | a real `vite build` artifact of that same configuration, served by `vite preview` | the activation gate surviving an actual production bundle |

The compiled artifact genuinely carries the ambient measurement id in its bundle,
so 4319 is the strongest local evidence that the gate is not a dev-only
behaviour. **None of the three says anything about the live Vercel project**: its
environment variables and build settings have not been inspected by this work,
and nothing here is a deployment. `reuseExistingServer` is `false` for all three,
so an unrelated local server on one of those ports fails the run instead of
silently satisfying a gate test.

Every remote request is blocked from the browser context
before the first navigation; Google endpoints are fulfilled with an inert local
body and recorded so that a request which should never happen is visible;
`tel:`/`mailto:` clicks are captured, never dialled or sent. Screenshots land in
`test-results/measurement-screenshots/` at 1440, 390 and 320.

The inert tag models `config` parameter inheritance — parameters set by `config`
persist and are inherited by later events — so a test can see a stale or freshly
captured campaign riding along on an event that omits the fields itself. It is a
deliberate simplification of real parameter scoping and is **not** evidence about
Google's behaviour.

Requires the Playwright browser binaries (`npx playwright install chromium`) and
the ability to bind a loopback port.

## 8. What local fixtures do and do not prove

**Proved here:** application sequencing — nothing before a grant, no denied-state
ping, single init, one pageview per navigation, whole-payload allowlist
rejection, the source state machine including expiry and campaign changes during
a request, exactly-once success, in-place withdrawal with no form loss,
cross-document teardown, fail-closed teardown when a preference expires or
becomes unreadable in a still-open document, withdrawal taking effect even when
it cannot be persisted, and the activation gate holding in a compiled production
bundle.

**Snapshot-bound success, including the inherited campaign.** Omitting the
wrapper's `source`/`medium`/`campaign` fields is not sufficient on its own:
`config` parameters are inherited by later events, so a source that expired — or
a *different* arrival captured while the request was out — would still label the
submission behind the event's back. When the submission snapshot is no longer the
current attribution, the adapter therefore sends empty `campaign_source`,
`campaign_medium` and `campaign_name` **at event scope** for that one payload.
Google's gtag.js reference states that event parameters take precedence over
`config` parameters and that values set in one scope do not modify another, so
the page keeps its own campaign context — the visitor really is on a page reached
through a GBP link — and the next ordinary event still carries it. Where there is
no campaign to inherit, nothing is added; absence, not an empty string, is the
correct evidence in a fresh document.

That precedence rule is documentation about parameter scoping. It is **not**
evidence about how Google's own attribution models treat an empty campaign on a
single event, and native acquisition reporting remains a #83 gate.

**Not proved here, and a #83 activation gate:** that the shipped `gtag.js`
honours `ga-disable` comprehensively; that no residual provider lifecycle traffic
escapes; that Enhanced Measurement, retention and signals settings are actually
set in the console; that events arrive as expected; real-tag revocation;
production build-to-destination binding; native acquisition reporting; and an
approved rollback. Passing a modelled tag demonstrates application logic, not
those external properties.

A direct Google tag has full page privileges. This wrapper is a discipline over
what *we* send; it is not a script sandbox, an anonymity guarantee or a
legal-compliance guarantee.

## 9. Rollback handoff

Setting `MEASUREMENT_ACTIVATION_APPROVED` back to `false` and redeploying returns
every build to the inert state described in section 1 — no tag, no storage, no
consent UI. That is a code change, not an environment change. Removing
`VITE_GA4_MEASUREMENT_ID` also produces an inert build, but it is not the
approved rollback on its own because it changes the destination rather than the
decision. Data already received by Google is not removed by either action; that
is a provider-side request under #83.
