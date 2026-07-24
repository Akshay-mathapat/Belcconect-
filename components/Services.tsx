export default function Services() {
  const services = [
    { label: "Electricians", img: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300&h=300&fit=crop" },
    { label: "Plumbers", img: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=300&h=300&fit=crop" },
    { label: "Cleaners", img: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&h=300&fit=crop" },
    { label: "Movers", img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&h=300&fit=crop" },
    { label: "Gardeners", img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&h=300&fit=crop" },
    { label: "Painters", img: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=300&h=300&fit=crop" },
    { label: "Handyman", img: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&h=300&fit=crop" },
    { label: "HVAC", img: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=300&h=300&fit=crop" },
    { label: "Mechanics", img: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=300&h=300&fit=crop" },
    { label: "Pest control", img: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=300&h=300&fit=crop" },
  ];

  return (
    <section className="bg-[#FAF7F1]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-[#1F5F5B]">
          Our services
        </div>
        <h2 className="max-w-lg font-serif text-4xl leading-tight text-[#1C2321]">
          Book trusted help for anything.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-[#5B564C]">
          48 categories, transparent flat pricing, and pros who show up on time.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {services.map((s) => (
            
             <a key={s.label}
              href="#"
              className="group rounded-xl border border-[#E4DFD3] bg-white p-3 transition-shadow hover:shadow-md"
            >
              <div className="aspect-square overflow-hidden rounded-lg bg-[#F1EDE2]">
                <img
                  src={s.img}
                  alt={s.label}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1C2321]">{s.label}</span>
                <span className="text-[#1F5F5B] transition-transform group-hover:translate-x-0.5">→</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}