export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  body: string;
}

export const posts: Post[] = [
  {
    slug: "six-months-out-what-to-do-first",
    title: "Six Months Out: The Moves That Actually Matter",
    excerpt:
      "Everyone tells you to book the venue first. But there are a few less-obvious decisions at the six-month mark that will quietly save your entire wedding.",
    category: "Planning",
    date: "April 10, 2026",
    readTime: "5 min read",
    image: "/photos/pt2.jpg",
    body: `
Six months feels like forever — until it doesn't. If you're sitting at the six-month mark and your to-do list looks like a CVS receipt, take a breath. Not everything on it matters equally.

Here's what we've seen make or break the final stretch:

## Lock your coordinator before your florist

I know, I know — flowers are fun. Coordinators are logistics. But your coordinator will shape every single vendor relationship you build from here on out. We catch the conflicts in contracts before you sign them, we know which venues have tricky load-in rules, and we'll tell you the honest truth about whether that florist's "minimum" is going to blow your budget.

Book coordination first. Then go enjoy flower appointments.

## Have the "who sits where" conversation now

Not the seating chart — that comes later. I mean the harder conversation: are your families going to be civil? Is there a guest situation your partner hasn't fully told their side of the family about? Is someone getting an invitation that's going to cause drama?

Six months is enough runway to handle these conversations without panic. Two months is not.

## Get your dress order timeline confirmed in writing

Bridal boutiques will give you a verbal "oh that'll be fine" right up until it isn't. Get the production timeline, the delivery date, and the alteration window all documented. Ask specifically what happens if the dress arrives late. Ask it to their face. Watch the answer.

Standard alterations take 6–8 weeks. If your dress arrives at the 10-week mark, you're cutting it close.

## Build your vendor tip budget now

Nobody talks about this. You will tip your photographer, your caterer's staff, your hair and makeup team, your coordinator, your DJ, and probably your venue coordinator too. On a wedding with 100 guests, that's easily $1,500–$2,500 in tips that couples forget to plan for.

Put it in the budget now, while there's still room to adjust.

## Stop looking at inspiration

Seriously. At six months, you should be narrowing, not expanding. Every new inspiration board is a potential pivot that costs time and sometimes money. You have a vision. Protect it.

---

You don't need to do everything at once. You need to do the right things in the right order. That's what planning actually is.

If you're not sure what your "right order" looks like — that's exactly what a partial planning consultation is for. [Let's chat.](#inquiry)
    `.trim(),
  },
  {
    slug: "day-of-coordination-myths",
    title: "Day-of Coordination: What It Actually Includes (And What It Doesn't)",
    excerpt:
      "A lot of couples come to us thinking day-of coordination means someone shows up the morning of the wedding. It doesn't — and here's what you're actually getting.",
    category: "Services",
    date: "March 28, 2026",
    readTime: "4 min read",
    image: "/photos/pt3.jpg",
    body: `
The phrase "day-of coordination" is genuinely misleading. We've thought about lobbying to change the industry term. We haven't won that fight yet.

Here's the reality:

## We start weeks before the wedding

A real day-of package begins with an initial consultation, a venue walkthrough, and a detailed review of every vendor contract you've already signed. We're looking for overlaps, gaps, and anything that looks like it could go sideways under pressure.

At Femme Events, our day-of package includes:
- One detailed venue walkthrough before the wedding
- Full vendor contact collection and timeline distribution
- A day-of timeline we build from scratch (not a template)
- Rehearsal coordination the evening before
- Two coordinators on the actual day, for eight hours

That last part matters. One coordinator cannot be in the bridal suite and at the venue entrance at the same time. You need two.

## What it doesn't include

Day-of coordination is not design. It doesn't include vendor sourcing, mood boards, or budget management. If you want someone to help you figure out *what* your wedding looks like, that's partial planning.

Day-of coordination assumes you've made the big decisions and you need someone to make sure they actually happen.

## The question to ask yourself

Have you already booked your venue, photographer, caterer, and florist? Do you know what the day is supposed to look like — you're just worried about execution?

If yes: day-of is probably right for you.

If you're still building the vision: let's talk about partial planning instead.

---

Not sure which package fits your situation? Fill out our inquiry form and we'll tell you honestly what you actually need.
    `.trim(),
  },
  {
    slug: "atlanta-wedding-venues-honest-take",
    title: "Atlanta Wedding Venues: An Honest Take From Someone Who's Worked Them All",
    excerpt:
      "Beautiful photos don't tell you about the loading dock situation, the noise ordinance, or the fact that the bridal suite is the size of a closet. We do.",
    category: "Venues",
    date: "March 14, 2026",
    readTime: "6 min read",
    image: "/photos/kj1.jpg",
    body: `
Venue tours are designed to make you fall in love. They happen on sunny days, rooms are staged perfectly, and your tour guide has done this hundreds of times. Their job is to sell.

Our job is to make sure you don't get surprised on your wedding day.

Here's what we pay attention to on every walkthrough — and what you should be asking before you sign.

## Where does the catering come in?

This sounds boring. It is not boring. If the catering entrance is through the same hallway your guests use, your cocktail hour will smell like food before the reveal. If the kitchen is on a different floor from the reception space, service will be slow. Ask to see the load-in route.

## What's the backup plan for outdoor ceremonies?

Every venue with an outdoor ceremony space will tell you they have a backup plan. Ask to *see* the backup space. Actually walk into it. If the backup is a tent that holds 80% of your guest count and you're at 150, that's a problem you want to know about in February, not in June.

## What does the bridal suite actually look like?

Not the Instagram photos of the bridal suite. The actual suite, with the lights on, on a random Tuesday. How many outlets does it have? Is there a mirror large enough for hair and makeup? Will your entire bridal party fit? Will the photographer be able to work in it?

## What's the noise ordinance?

Atlanta venues vary wildly here. Some neighborhoods have strict cutoffs. Some venues have internal sound rules that don't match what they advertise. Know the hard stop before you book your DJ.

## Does the venue have a preferred vendor list?

If yes: are you required to use it, or is it just a recommendation? Required lists can limit your options significantly. Ask specifically about catering — some venues require in-house catering, which removes one of your biggest budget levers.

---

We've worked most of the major Atlanta and metro venues. If you're trying to narrow down your list and want a real, honest opinion — put it in your inquiry form. We'll tell you what we actually think.
    `.trim(),
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}
