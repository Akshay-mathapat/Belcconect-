export default function Hero() {
  const categories = [
    {
      label: "Electricians",
      meta: "4.9 · 312 nearby",
      rotate: "-4deg",
      img: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=80&h=80&fit=crop",
    },
    {
      label: "Plumbers",
      meta: "4.8 · 284 nearby",
      rotate: "3deg",
      img: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=80&h=80&fit=crop",
    },
    {
      label: "Cleaners",
      meta: "4.9 · 509 nearby",
      rotate: "-2deg",
      img: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=80&h=80&fit=crop",
    },
    {
      label: "Movers",
      meta: "4.7 · 176 nearby",
      rotate: "5deg",
      img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=80&h=80&fit=crop",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-[#FAF7F1]">
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 py-24 md:grid-cols-2 md:py-32">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#1F5F5B]">
            City Connect &middot; Local Directory
          </div>

          <h1 className="font-serif text-5xl leading-[1.08] text-[#1C2321] md:text-6xl">
            Every local pro,
            <br />
            <span className="italic text-[#1F5F5B]">one street over.</span>
          </h1>

          <p className="mt-6 max-w-md text-base leading-7 text-[#5B564C]">
            Electricians, plumbers, cleaners, and movers — vetted by your
            neighbors, booked in minutes, paid without the paperwork.
          </p>

          {/* Search bar */}
          <div className="mt-8 flex max-w-md items-center gap-2 rounded-full border border-[#D8D2C4] bg-white px-2 py-2 shadow-sm">
            <svg
              className="ml-2 h-4 w-4 shrink-0 text-[#8B8578]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0a7 7 0 10-9.9-9.9 7 7 0 009.9 9.9z" />
            </svg>
            <input
              type="text"
              placeholder="Try 'plumber near me'"
              className="w-full bg-transparent text-sm text-[#1C2321] placeholder-[#8B8578] outline-none"
            />
            <button className="shrink-0 rounded-full bg-[#1F5F5B] px-5 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
              Search
            </button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button className="rounded-full bg-[#1F5F5B] px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
              Browse the directory
            </button>
            <button className="rounded-full border border-[#D8D2C4] px-6 py-3 text-sm font-semibold text-[#1C2321] transition-colors hover:bg-white">
              List your business
            </button>
          </div>

          <div className="mt-14 flex gap-8 border-t border-[#E4DFD3] pt-6">
            {[
              ["10,412", "pros indexed"],
              ["48", "categories"],
              ["25", "cities"],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="font-serif text-2xl text-[#1C2321]">{n}</div>
                <div className="text-xs text-[#8B8578]">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto h-[380px] w-full max-w-sm">
          {categories.map((cat, i) => (
            <div
              key={cat.label}
              className="absolute inset-x-6 flex items-center gap-4 rounded-lg border border-[#E4DFD3] bg-white px-5 py-4 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md"
              style={{ top: `${i * 78}px`, transform: `rotate(${cat.rotate})`, zIndex: i }}
            >
              <img
                src={cat.img}
                alt={cat.label}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
              <div>
                <div className="text-sm font-semibold text-[#1C2321]">{cat.label}</div>
                <div className="text-xs text-[#8B8578]">{cat.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}