function StepScreen({ variant }: { variant: "browse" | "book" | "done" }) {
  return (
    <div className="mx-auto w-40 rounded-[28px] border-4 border-[#3A423E] bg-[#FAF7F1] p-3 shadow-lg">
      {variant === "browse" && (
        <div className="space-y-2">
          <div className="h-2 w-16 rounded-full bg-[#D8D2C4]" />
          <div className="flex flex-wrap gap-1.5">
            {["Elec.", "Plumb.", "Clean", "Movers"].map((t) => (
              <span
                key={t}
                className="rounded-full bg-[#E1F5EE] px-2 py-1 text-[9px] font-medium text-[#0F6E56]"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="h-16 rounded-lg bg-white" />
        </div>
      )}
      {variant === "book" && (
        <div className="space-y-2">
          <div className="h-16 rounded-lg bg-white p-2">
            <div className="h-2 w-12 rounded-full bg-[#D8D2C4]" />
            <div className="mt-2 h-2 w-8 rounded-full bg-[#1F5F5B]" />
          </div>
          <div className="rounded-full bg-[#1F5F5B] py-1.5 text-center text-[9px] font-semibold text-white">
            Add to booking
          </div>
        </div>
      )}
      {variant === "done" && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E1F5EE] text-[#0F6E56]">
            ✓
          </div>
          <div className="h-2 w-20 rounded-full bg-[#D8D2C4]" />
          <div className="h-2 w-14 rounded-full bg-[#E4DFD3]" />
        </div>
      )}
    </div>
  );
}

export default function HowItWorks() {
  const steps = [
    { n: "Step 1", title: "Pick from 48 services", body: "Browse the directory by category or search for exactly what you need.", variant: "browse" as const },
    { n: "Step 2", title: "Book in one visit", body: "Stack multiple tasks into one booking — your pro handles all of it.", variant: "book" as const },
    { n: "Step 3", title: "Pay and you're done", body: "Instant, scheduled, or recurring. No cash, no paperwork.", variant: "done" as const },
  ];

  return (
    <section className="bg-[#1C2321]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-[#5DCAA5]">
          How it works
        </div>
        <h2 className="max-w-lg font-serif text-4xl leading-tight text-white">
          Simple steps to get help.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-[#B8B2A2]">
          Follow these steps to get trusted help at your door in minutes.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n}>
              <StepScreen variant={s.variant} />
              <div className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-[#5DCAA5]">
                {s.n}
              </div>
              <h3 className="mt-1 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#B8B2A2]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}