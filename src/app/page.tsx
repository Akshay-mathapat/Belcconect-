import { Hero } from "@/components/sections/Hero";
import { TrustMetrics } from "@/components/sections/TrustMetrics";
import { ServiceCategories } from "@/components/sections/ServiceCategories";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { WhyChooseUs } from "@/components/sections/WhyChooseUs";
import { Testimonials } from "@/components/sections/Testimonials";
import { Guarantee } from "@/components/sections/Guarantee";
import { LocalFocus } from "@/components/sections/LocalFocus";
import { ProviderRecruitment } from "@/components/sections/ProviderRecruitment";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustMetrics />
      <ServiceCategories />
      <HowItWorks />
      <WhyChooseUs />
      <LocalFocus />
      <ProviderRecruitment />
      <Testimonials />
      <Guarantee />
      <Footer />
    </>
  );
}
