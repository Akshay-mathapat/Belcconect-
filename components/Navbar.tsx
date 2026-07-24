"use client";

export default function Navbar() {
  return (
    <div className="sticky top-0 z-50 bg-[#FAF7F1] px-4 pt-4">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-[#E4DFD3] bg-white px-6 py-3"
        style={{
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.8) inset, 0 -1px 0 rgba(28,35,33,0.04) inset, 0 8px 20px -6px rgba(28,35,33,0.12), 0 2px 6px -1px rgba(28,35,33,0.08)",
        }}
      >
        <h1
          className="text-xl font-bold tracking-tight text-[#1C2321]"
          style={{ textShadow: "0 1px 0 rgba(255,255,255,0.6)" }}
        >
          City<span className="text-[#1F5F5B]">Connect</span>
        </h1>

        <div className="hidden items-center gap-8 md:flex">
          {["Home", "Services", "About", "Contact"].map((item) => (
            
             <a key={item}
              href="#"
              className="text-sm font-medium text-[#5B564C] transition-colors hover:text-[#1C2321]"
            >
              {item}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
        <button
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform active:translate-y-0.5"
          style={{
            background: "linear-gradient(180deg, #256B66 0%, #1F5F5B 55%, #184F4B 100%)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.25) inset, 0 -2px 0 rgba(0,0,0,0.15) inset, 0 8px 14px -4px rgba(31,95,91,0.55)",
          }}
        >
          Register
        </button>
        <button
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform active:translate-y-0.5"
          style={{
            background: "linear-gradient(180deg, #256B66 0%, #1F5F5B 55%, #184F4B 100%)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.25) inset, 0 -2px 0 rgba(0,0,0,0.15) inset, 0 6px 14px -4px rgba(31,95,91,0.55)",
          }}
        >
          Login
        </button>
        </div>
      </nav>
    </div>
  );
}