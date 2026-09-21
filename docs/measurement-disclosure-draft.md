# Analytics disclosure — DRAFT, pending owner review

**Status: DRAFT. Not approved for publication.** This is proposed visitor-facing
copy for issue #161. Publishing it — on the site, in a privacy page, or in any
build that reaches the public — is a separate approval gate held with website #83
and PAPI-74. Nothing here has been reviewed by Karan or by anyone with legal
authority, and no claim below should be repeated as approved wording.

The same draft copy appears in the consent panel's "Privacy details" expander
(`src/components/ConsentNotice.tsx`), where it is marked in the DOM with
`data-disclosure-state="draft-pending-owner-review"`. The panel does not render
at all in a production build, because production measurement is hard-disabled.

---

## Draft copy

### A quick note on analytics

We would love to count a few basic things — which pages get visited and which
packages people ask about — so we can make this site more useful. We never send
your name, email, phone number or anything you type into the inquiry form.

**Allow analytics** / **No thanks**. Saying no changes nothing else: browsing,
choosing a package and sending an inquiry all work exactly the same. You can
change your mind any time from **Analytics preferences** in the footer.

### Privacy details

**What we would measure.** A page category for each page you open (for example
"home", "about", "journal post" — not the full address), clicks on our inquiry
buttons, clicks on the footer phone and email links, and inquiry forms that our
form provider accepts. If you reached us from our Google Business Profile
listing, we record that as a source: Google, organic, GBP.

**What we never send.** Your name, email address, phone number, event date,
venue, guest count or message. Not the full web address of the page, not the
search terms in it, and not the site you arrived from.

**Who processes it.** Google Analytics 4, run by Google. It sets cookies in this
browser that identify the browser session, not you by name. It is a Google
product running on Google's servers, with the access to this page that any
script on the page has.

**How long.** Your choice is kept in this browser for six months. Before you
choose, nothing about how you arrived is stored at all; if you say no thanks,
nothing is stored either. If you allow analytics, the record of how you arrived
lasts 30 minutes of inactivity in this tab only, and then it goes on its own
without you having to do anything. Google Analytics cookies are set to last for
the browser session.

**Your inquiry is separate.** What you send through the inquiry form goes to our
form provider and on to us by email. That is how we reply to you, and it happens
whether or not you allow analytics.

**Changing your mind.** Use **Analytics preferences** in the footer at any time.
Turning analytics off stops future collection in this browser, clears the
analytics cookies we set and clears how-you-arrived information. It cannot undo
information that was already sent.

---

## Review notes — read before approving

These are the places where the draft is deliberately incomplete or where an
approver has to make a decision. They are not fixable by a copy edit.

1. **Inquiry and email retention is a genuine unknown.** How long Formspree keeps
   submissions, how long forwarded email is kept, and whether exports exist are
   all unresolved. The draft says the inquiry is handled separately and gives no
   number, on purpose. **Do not fill in a duration** to make the paragraph look
   complete; get the answer first. This is an activation blocker.
2. **No blanket promises.** The draft avoids "anonymous", "we never collect
   personal data" and any statement about legal compliance. Data minimisation is
   a discipline about what this site sends; it is not a guarantee about
   everything a Google tag can observe, and it is not legal advice.
3. **"Session" cookies can outlive a visit.** Browsers that restore a previous
   session can bring session cookies back. The draft says "set to last for the
   browser session", which is accurate about the setting, not a promise about
   every browser.
4. **Tab-scoped attribution.** "In this tab only" is accurate for how the source
   record works, but some browsers copy session storage into a tab opened from a
   link. If a reviewer wants that nuance stated, it needs a sentence here; today
   it is documented in `docs/analytics.md` rather than in visitor copy.
5. **Withdrawal is honest about its limit.** "It cannot undo information that was
   already sent" is deliberate. Removing it would overstate what withdrawal does.
6. **Nothing is live.** The consent panel and this copy do not appear on the
   production site today. If activation is approved under #83, this copy must be
   approved in the same pass — activating the code without approved copy would
   publish unreviewed wording.
7. **Tone check needed.** The draft aims for warm, plain and calm, without
   wedding-themed jokes, guilt or pressure. A read-through against Femme's brand
   voice is still wanted.
8. **Status wording when the browser refuses to save.** If the preference cannot
   be written, the panel distinguishes two cases rather than using one line for
   both: a failed *grant* says analytics stays off; a failed *refusal* says
   analytics is switched off in this tab but the choice was not saved, so other
   open tabs and the next visit may still have it on. That second sentence is
   deliberately not reassuring — claiming the choice had been remembered, or that
   other tabs were updated, would be false. Reviewers should check the tone, not
   soften the meaning.
9. **Not derived from any other brand's copy.** The panel's layout is inspired by
   the JMD consent pattern, but the wording here is written for Femme. No JMD
   copy, storage key, retention value or measurement destination is reused.
