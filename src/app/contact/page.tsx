import Navigation from "@/components/sections/Navigation";
import Footer from "@/components/sections/Footer";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <Navigation />
      <div className="flex-1 flex items-center justify-center pt-24 pb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 capitalize">contact</h1>
          <p className="text-muted-foreground">This page is under construction.</p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
