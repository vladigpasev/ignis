import Header from "./components/header.jsx";
import Hero from "./components/hero.jsx";
import Feature from "./components/feature.jsx";
import FAQ from "./components/faq.jsx";
import ContactForm from "./components/contact.jsx";
import Footer from "./components/footer.jsx";

export default function Home() {
  return (
    <div>
      <Header />
      {/* Offset content for fixed header to avoid overlap */}
      <div className="pt-16 md:pt-20">
        <Hero />
        <div className="max-w-[1280px] mx-auto">
          <section id="features" className="scroll-mt-28">
            <Feature />
          </section>

          <section id="faq" className="scroll-mt-28">
            <FAQ />
          </section>
        </div>

        <section id="contact" className="scroll-mt-28">
          <ContactForm />
        </section>
      </div>
      <Footer />
    </div>
  );
}
