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
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  return { ref, index, scrollToIndex };
}
