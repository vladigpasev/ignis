import Header from "./components/header.jsx";
import Hero from "./components/hero.jsx";
import Feature from "./components/feature.jsx";
import CaseStudies from "./components/case.jsx";
import Testimonials from "./components/testimonials.jsx";
import ContactForm from "./components/contact.jsx";
import Footer from "./components/footer.jsx";

export default function Home() {
  return (
    <div>
      <Header />
    <div className="max-w-[1280px] mx-auto">
      <Hero />
      <Feature />
      <CaseStudies />
      <Testimonials />
      <ContactForm />
    </div>
    <Footer />
    </div>
  );
}
