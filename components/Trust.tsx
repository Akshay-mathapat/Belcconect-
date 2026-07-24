export default function Trust() {
  const stats = [
    { label: "Homes served", value: "500,000+" },
    { label: "Hours saved", value: "1,200,000+" },
    { label: "Verified pros", value: "10,000+" },
  ];

  return (
    <section className="border-y border-[#E4DFD3] bg-[#EEF3EE]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-[#1F5F5B]">
          Why City Connect
        </div>
        <h2 className="max-w-lg font-serif text-4xl leading-tight text-[#1C2321]">
          No more guessing who to call.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-[#5B564C]">
          Every pro on the directory is background-checked and rated by real
          neighbors, not anonymous reviews.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[#D7E3D8] bg-white/60 px-6 py-5"
            >
              <div className="font-serif text-3xl text-[#1C2321]">{s.value}</div>
              <div className="mt-1 text-sm text-[#5B564C]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}