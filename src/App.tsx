/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import Services from "./components/Services";
import Process from "./components/Process";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import Inquiry from "./components/Inquiry";
import Footer from "./components/Footer";

export default function App() {
  return (
    <main className="relative min-h-screen">
      <Navbar />
      <Hero />
      <About />
      <Services />
      <Process />
      <Testimonials />
      <FAQ />
      <Inquiry />
      <Footer />
    </main>
  );
}
