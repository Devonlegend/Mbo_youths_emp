import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import Programmes from "./components/Programmes";
import HowItWorks from "./components/HowItWorks";
import Eligibility from "./components/Eligibility";
import FAQ from "./components/FAQ";
import Contact from "./components/Contact";
import CTABanner from "./components/CTABanner";
import Footer from "./components/Footer";


export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <About />
      <Programmes />
      <HowItWorks />
      <Eligibility />
      <FAQ />
      <Contact />
      <CTABanner />
      <Footer />
    </main>
  );
}