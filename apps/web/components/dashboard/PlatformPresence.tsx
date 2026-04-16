"use client";
// components/dashboard/PlatformPresence.tsx
// Shows which academic platforms the researcher has a presence on.
// Data is inferred from linked IDs (ORCID, OpenAlex) and sync jobs.

interface Platform {
  id: string;
  name: string;
  status: "connected" | "found" | "missing" | "unknown";
  profileUrl?: string;
  note?: string;
}

interface PlatformPresenceProps {
  platforms: Platform[];
}

const STATUS_CONFIG = {
  connected: {
    label: "Connected",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    ),
  },
  found: {
    label: "Profile found",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-400",
    text: "text-blue-700",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
      </svg>
    ),
  },
  missing: {
    label: "Not found",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
    text: "text-amber-700",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  unknown: {
    label: "Unknown",
    bg: "bg-gray-50",
    border: "border-gray-200",
    dot: "bg-gray-300",
    text: "text-gray-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    ),
  },
} as const;

// Platform icons as simple SVG/text — avoids external image deps
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  orcid: (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "#A6CE39" }}>
      <span className="text-white text-xs font-bold">iD</span>
    </div>
  ),
  openalex: (
    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
      <span className="text-white text-xs font-bold">OA</span>
    </div>
  ),
  scholar: (
    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
      <span className="text-white text-xs font-bold">GS</span>
    </div>
  ),
  semantic: (
    <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center">
      <span className="text-white text-xs font-bold">S2</span>
    </div>
  ),
  researchgate: (
    <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center">
      <span className="text-white text-xs font-bold">RG</span>
    </div>
  ),
  academia: (
    <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center">
      <span className="text-white text-xs font-bold">Ac</span>
    </div>
  ),
};

export function PlatformPresence({ platforms }: PlatformPresenceProps) {
  const connected = platforms.filter((p) => p.status === "connected").length;
  const total = platforms.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">
          {connected}/{total} platforms active
        </p>
        <div className="flex gap-0.5">
          {platforms.map((p) => (
            <div
              key={p.id}
              className={`w-2 h-2 rounded-full ${STATUS_CONFIG[p.status].dot}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      <ul className="space-y-3" aria-label="Platform presence status">
        {platforms.map((platform) => {
          const config = STATUS_CONFIG[platform.status];
          return (
            <li
              key={platform.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${config.bg} ${config.border}`}
              aria-label={`${platform.name}: ${config.label}`}
            >
              <div aria-hidden="true">
                {PLATFORM_ICONS[platform.id] ?? (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                    {platform.name[0]}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{platform.name}</p>
                {platform.note && (
                  <p className="text-xs text-gray-500 truncate">{platform.note}</p>
                )}
              </div>

              <div className={`flex items-center gap-1 text-xs font-medium ${config.text}`}>
                <span aria-hidden="true">{config.icon}</span>
                <span>{config.label}</span>
              </div>

              {platform.profileUrl && platform.status !== "missing" && (
                <a
                  href={platform.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors ml-1"
                  aria-label={`View ${platform.name} profile (opens in new tab)`}
                >
                  ↗
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Factory: build platform list from researcher data
export function buildPlatforms(researcher: {
  orcidId?: string;
  openAlexId?: string;
}): Platform[] {
  return [
    {
      id: "orcid",
      name: "ORCID",
      status: researcher.orcidId ? "connected" : "missing",
      profileUrl: researcher.orcidId
        ? `https://orcid.org/${researcher.orcidId}`
        : undefined,
      note: researcher.orcidId
        ? researcher.orcidId
        : "Connect ORCID to verify your identity",
    },
    {
      id: "openalex",
      name: "OpenAlex",
      status: researcher.openAlexId ? "found" : "unknown",
      profileUrl: researcher.openAlexId
        ? `https://openalex.org/authors/${researcher.openAlexId}`
        : undefined,
      note: researcher.openAlexId
        ? "Profile indexed"
        : "Will appear after first sync",
    },
    {
      id: "scholar",
      name: "Google Scholar",
      status: "unknown",
      note: "We don't index Scholar — link it manually",
    },
    {
      id: "semantic",
      name: "Semantic Scholar",
      status: researcher.openAlexId ? "found" : "unknown",
      note: researcher.openAlexId ? "Auto-matched via OpenAlex" : undefined,
    },
    {
      id: "researchgate",
      name: "ResearchGate",
      status: "unknown",
      note: "Manually add your RG URL in profile settings",
    },
  ];
}
