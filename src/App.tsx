/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { measurement } from "./lib/measurement/index.ts";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import About from "./components/About";
import Services from "./components/Services";
import Process from "./components/Process";
import Testimonials from "./components/Testimonials";
import Vendors from "./components/Vendors";
import FAQ from "./components/FAQ";
import Inquiry from "./components/Inquiry";
import ConsentNotice from "./components/ConsentNotice";

// Journal routes are split out so homepage visitors don't pay to download
// blog code on first load.
const BlogIndex = lazy(() => import("./pages/BlogIndex"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const WhatHappensNextPage = lazy(() => import("./pages/WhatHappensNext"));
const AboutPage = lazy(() => import("./pages/AboutPage"));

// On a full-page load (or client navigation) to a "/#section" URL, the browser
// tries to scroll to the fragment before React has rendered the target, so the
// scroll is lost and the page stays at the top. Re-run the scroll, retrying for
// a few frames until the target element exists.
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    let timeout = 0;
    let attempts = 0;
    const scrollToTarget = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "start" });
        requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
        return;
      }
      if (attempts++ < 50) timeout = window.setTimeout(scrollToTarget, 50);
    };
    timeout = window.setTimeout(scrollToTarget, 0);
    return () => window.clearTimeout(timeout);
  }, [pathname, hash]);
  return null;
}

// Browser history keeps the current scroll position across SPA route changes.
// Reset ordinary route navigations while leaving hash links to ScrollToHash.
function ScrollToRouteTop() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search, hash]);
  return null;
}

// Reports each route change to the measurement runtime, which decides whether
// anything is counted. The raw search string is passed for source classification
// only — it is never forwarded to the provider, and the pageview itself carries
// a static route label. A query- or hash-only change (switching package) is not
// a pageview; Back/Forward to a different pathname is.
function RouteAnalytics() {
  const location = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    measurement.recordNavigation(location.pathname, location.search, navigationType);
  }, [location.pathname, location.search, navigationType]);
  return null;
}

function Home() {
  return (
    <main className="relative min-h-screen">
      <Hero />
      <About />
      <Services />
      <Process />
      <Testimonials />
      <Vendors />
      <FAQ />
      <Inquiry />
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteAnalytics />
      <ScrollToRouteTop />
      <ScrollToHash />
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-femme-cream" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/what-happens-next" element={<WhatHappensNextPage />} />
          <Route path="/journal" element={<BlogIndex />} />
          <Route path="/journal/:slug" element={<BlogPost />} />
        </Routes>
      </Suspense>
      <Footer />
      <ConsentNotice />
    </BrowserRouter>
  );
}
