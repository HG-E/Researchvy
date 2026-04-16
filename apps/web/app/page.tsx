// apps/web/app/page.tsx
// Marketing landing page — first thing non-authenticated users see.

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50">
      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <span className="text-xl font-bold text-brand-700 tracking-tight">Researchvy</span>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-4xl mx-auto px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
          Researcher Visibility Intelligence Platform
        </div>

        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Know exactly how visible
          <br />
          <span className="text-brand-600">your research really is</span>
        </h1>

        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Researchvy connects your ORCID profile, computes a transparent visibility score,
          and gives you a clear roadmap to amplify your academic and policy impact.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="bg-brand-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
          >
            Connect ORCID & get your score →
          </Link>
          <Link href="#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
            How it works
          </Link>
        </div>
      </section>

      {/* ── Score Preview Card ── */}
      <section className="max-w-5xl mx-auto px-8 pb-20">
        <div className="card p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Overall score */}
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="50"
                    fill="none" stroke="#6366f1" strokeWidth="10"
                    strokeDasharray="314" strokeDashoffset="94"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900">70</span>
                  <span className="text-xs text-gray-500">/ 100</span>
                </div>
              </div>
              <p className="mt-3 font-semibold text-gray-800">Visibility Score</p>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full mt-1">Prominent</span>
            </div>

            {/* Score components */}
            <div className="col-span-2 space-y-4">
              {[
                { label: "Citation Impact",     score: 78, color: "bg-indigo-500", weight: "30%" },
                { label: "Policy Influence",    score: 65, color: "bg-emerald-500", weight: "25%" },
                { label: "Citation Velocity",   score: 55, color: "bg-blue-500", weight: "20%" },
                { label: "Collaboration Reach", score: 72, color: "bg-violet-500", weight: "15%" },
                { label: "Open Access Rate",    score: 80, color: "bg-amber-500", weight: "10%" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{item.label}</span>
                    <span className="text-gray-500">{item.score}/100 · {item.weight} weight</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            From ORCID to actionable insights in minutes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Connect ORCID",
                body: "One-click OAuth. We fetch your publications and profile with your consent — no scraping.",
              },
              {
                step: "02",
                title: "Get your score",
                body: "We compute a transparent, explainable score across 5 dimensions: citations, velocity, policy impact, open access, and collaboration.",
              },
              {
                step: "03",
                title: "Improve with guidance",
                body: "Concrete recommendations: which papers to make open access, policy consultations to submit to, conferences to target.",
              },
            ].map((item) => (
              <div key={item.step} className="card p-6">
                <span className="text-3xl font-black text-brand-200">{item.step}</span>
                <h3 className="text-lg font-semibold text-gray-900 mt-3 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 text-center text-sm text-gray-400">
        <p>Researchvy · Built for researchers, by researchers · Data: ORCID, OpenAlex</p>
      </footer>
    </main>
  );
}
