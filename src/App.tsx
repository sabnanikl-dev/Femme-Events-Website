/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import About from "./components/About";
import Services from "./components/Services";
import Testimonials from "./components/Testimonials";
import Inquiry from "./components/Inquiry";
import BlogIndex from "./pages/BlogIndex";
import BlogPost from "./pages/BlogPost";

function Home() {
  return (
    <main className="relative min-h-screen">
      <Hero />
      <About />
      <Services />
      <Testimonials />
      <Inquiry />
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/journal" element={<BlogIndex />} />
        <Route path="/journal/:slug" element={<BlogPost />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
