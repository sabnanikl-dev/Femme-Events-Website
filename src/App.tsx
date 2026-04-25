/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-femme-cream" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/journal" element={<BlogIndex />} />
          <Route path="/journal/:slug" element={<BlogPost />} />
        </Routes>
      </Suspense>
      <Footer />
    </BrowserRouter>
  );
}
