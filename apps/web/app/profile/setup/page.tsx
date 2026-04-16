"use client";
// apps/web/app/profile/setup/page.tsx
// Onboarding flow for new users — fill in profile then connect ORCID.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { profile, auth } from "@/lib/api";

const RESEARCH_FIELDS = [
  "Artificial Intelligence", "Machine Learning", "Computer Science",
  "Biology", "Medicine", "Physics", "Chemistry", "Economics",
  "Political Science", "Sociology", "Environmental Science",
  "Engineering", "Mathematics", "Psychology", "Education",
];

export default function ProfileSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"profile" | "orcid">("profile");
  const [form, setForm] = useState({
    displayName: "",
    institution: "",
    department: "",
    country: "",
    fields: [] as string[],
    bio: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleField(field: string) {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.includes(field)
        ? prev.fields.filter((f) => f !== field)
        : [...prev.fields, field].slice(0, 5), // max 5 fields
    }));
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSaving(true);

    const res = await profile.update(form);
    setIsSaving(false);

    if (!res.success) {
      setError((res as { success: false; error: { message: string } }).error.message);
      return;
    }

    setStep("orcid");
  }

  if (step === "orcid") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg card p-8 text-center">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-brand-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.5 17.5V9.5h3v8h-3zm1.5-10c-.828 0-1.5-.672-1.5-1.5S11.172 4.5 12 4.5s1.5.672 1.5 1.5S12.828 7.5 12 7.5z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">Connect your ORCID</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-8">
            ORCID is the global registry of researcher IDs. Connecting it lets us import all your
            publications automatically — no manual entry needed.
          </p>

          <div className="space-y-3">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/orcid`}
              className="flex items-center justify-center gap-3 w-full bg-[#A6CE39] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              <span className="text-lg">🔗</span>
              Connect ORCID iD
            </a>

            <button
              onClick={() => router.push("/dashboard")}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
            >
              Skip for now — I&apos;ll connect later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Set up your profile</h1>
          <p className="text-gray-500 text-sm mt-1">This helps us compute a more accurate visibility score</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleProfileSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
              <input
                type="text"
                required
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Dr. Jane Smith"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Institution</label>
                <input
                  type="text"
                  value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="MIT"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
                <input
                  type="text"
                  maxLength={2}
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="US"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Research fields <span className="text-gray-400 font-normal">(pick up to 5)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {RESEARCH_FIELDS.map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => toggleField(field)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.fields.includes(field)
                        ? "bg-brand-600 border-brand-600 text-white"
                        : "bg-white border-gray-300 text-gray-600 hover:border-brand-400"
                    }`}
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save & continue →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
