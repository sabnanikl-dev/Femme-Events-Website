/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { trackPageview } from "./lib/analytics";
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

// Journal routes are split out so homepage visitors don't pay to download
// blog code on first load.
const BlogIndex = lazy(() => import("./pages/BlogIndex"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const WhatHappensNextPage = lazy(() => import("./pages/WhatHappensNext"));

// Records an SPA pageview on each route change (GA4 only — Plausible's script
// auto-captures History API navigations). Rendered inside BrowserRouter.
function RouteAnalytics() {
  const location = useLocation();
  useEffect(() => {
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);
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
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-femme-cream" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/what-happens-next" element={<WhatHappensNextPage />} />
          <Route path="/journal" element={<BlogIndex />} />
          <Route path="/journal/:slug" element={<BlogPost />} />
        </Routes>
      </Suspense>
      <Footer />
    </BrowserRouter>
  );
}
