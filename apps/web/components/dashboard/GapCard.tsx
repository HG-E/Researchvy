"use client";
// components/dashboard/GapCard.tsx
// Surfaces the most impactful gaps in visibility — things the researcher
// can actually act on. Each gap links to a recommendation.

export interface Gap {
  id: string;
  category: "open_access" | "platform" | "profile" | "policy" | "citation";
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  actionLabel: string;
  actionHref?: string;
  count?: number; // e.g. "3 papers could be made open access"
}

interface GapCardProps {
  gaps: Gap[];
  onAction?: (gap: Gap) => void;
}

const SEVERITY_STYLE = {
  high: {
    border: "border-l-red-400",
    icon: "text-red-500",
    badge: "bg-red-50 text-red-700",
    label: "High impact",
  },
  medium: {
    border: "border-l-amber-400",
    icon: "text-amber-500",
    badge: "bg-amber-50 text-amber-700",
    label: "Medium impact",
  },
  low: {
    border: "border-l-gray-300",
    icon: "text-gray-400",
    badge: "bg-gray-50 text-gray-600",
    label: "Low impact",
  },
} as const;

const CATEGORY_ICONS: Record<Gap["category"], React.ReactNode> = {
  open_access: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
  ),
  platform: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16A8 8 0 0010 2zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  ),
  policy: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  ),
  citation: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  ),
};

export function GapCard({ gaps, onAction }: GapCardProps) {
  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-emerald-600">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">No gaps found</p>
        <p className="text-xs text-gray-400 mt-1">Your visibility profile looks complete</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Visibility gaps">
      {gaps.map((gap) => {
        const style = SEVERITY_STYLE[gap.severity];
        return (
          <li
            key={gap.id}
            className={`border-l-4 ${style.border} bg-white border border-gray-200 rounded-r-lg p-4`}
            aria-label={`${gap.severity} impact gap: ${gap.title}`}
          >
            <div className="flex items-start gap-3">
              <span className={`${style.icon} mt-0.5 flex-shrink-0`} aria-hidden="true">
                {CATEGORY_ICONS[gap.category]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">
                    {gap.title}
                    {gap.count !== undefined && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        ({gap.count})
                      </span>
                    )}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {gap.description}
                </p>
                {(gap.actionHref || onAction) && (
                  <div className="mt-3">
                    {gap.actionHref ? (
                      <a
                        href={gap.actionHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                      >
                        {gap.actionLabel} →
                      </a>
                    ) : (
                      <button
                        onClick={() => onAction?.(gap)}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                      >
                        {gap.actionLabel} →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
