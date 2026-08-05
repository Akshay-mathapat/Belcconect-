import Footer from "@/components/sections/Footer";

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 flex items-center justify-center pt-8 pb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 capitalize">blog</h1>
          <p className="text-muted-foreground">This page is under construction.</p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
