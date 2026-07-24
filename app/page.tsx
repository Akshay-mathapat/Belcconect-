import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Trust from "@/components/Trust";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FAF7F1]">
      <Navbar />
      <Hero />
      <Trust />
      <Services />
      <HowItWorks />
    </main>
  );
}