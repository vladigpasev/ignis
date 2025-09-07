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
      <Hero />
      <div className="max-w-[1280px] mx-auto">
        
      <section id="features">
        <Feature />
      </section>
        
      <section id="faq">
        <FAQ />
      </section>
        
      </div>
      
      <section id="contact">
        <ContactForm />
      </section>
      <Footer />
    </div>
  );
}

