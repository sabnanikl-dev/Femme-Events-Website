import { useEffect, useRef, useState } from "react";

// Tracks which child of a horizontally-scrolling container is currently
// the "active" card by intersection ratio. Returns a ref to attach to
// the scroll container, the active index, and a programmatic scroller
// for click-to-navigate dots.
//
// Built for mobile-only carousels: on desktop the same children render
// in a grid (no horizontal scroll) and the hook stays harmlessly idle
// because IntersectionObserver fires once per child and `setIndex` ends
// up at 0 — the dot indicator is hidden in that layout anyway.
export function useCarouselIndex<T extends HTMLElement = HTMLDivElement>(
  itemCount: number,
) {
  const ref = useRef<T | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || itemCount === 0) return;
    const cards = Array.from(el.children) as HTMLElement[];
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const i = cards.indexOf(visible.target as HTMLElement);
        if (i >= 0) setIndex(i);
      },
      { root: el, threshold: [0.5, 0.75, 1] },
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [itemCount]);

  const scrollToIndex = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const card = el.children[i] as HTMLElement | undefined;
    if (!card) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Match the card's CSS snap alignment so dot navigation lands where a
    // swipe would settle.
    // `offsetLeft` is measured from the shared offset parent, so subtracting
    // the container's own offset yields the card's left edge within the scroll
    // content. Clamp to the valid scroll range so edge cards don't overscroll.
    const align = getComputedStyle(card).scrollSnapAlign;
    const leftEdge = card.offsetLeft - el.offsetLeft;
    const target = align.includes("center")
      ? leftEdge - (el.clientWidth - card.clientWidth) / 2
      : leftEdge;
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollTo({
      left: Math.max(0, Math.min(target, maxScroll)),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return { ref, index, scrollToIndex };
}
