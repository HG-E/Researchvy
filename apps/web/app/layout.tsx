// apps/web/app/layout.tsx
// Root layout — wraps every page with auth context, global styles, skip nav.

import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env["NEXTAUTH_URL"] ?? "https://researchvy.com"
  ),
  title: {
    default: "Researchvy — Research Visibility Intelligence",
    template: "%s | Researchvy",
  },
  description:
    "Understand and improve your academic visibility. Track citations, policy impact, and get actionable recommendations based on ORCID and OpenAlex data.",
  keywords: [
    "research visibility",
    "academic impact",
    "researcher profile",
    "h-index",
    "citation score",
    "ORCID",
    "OpenAlex",
    "policy impact",
  ],
  authors: [{ name: "Researchvy" }],
  creator: "Researchvy",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Researchvy",
    title: "Researchvy — Research Visibility Intelligence",
    description:
      "Compute your free visibility score across citation impact, policy influence, open access, and collaboration reach.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Researchvy — Research Visibility Score",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@researchvy",
    creator: "@researchvy",
    title: "Researchvy — Research Visibility Intelligence",
    description: "Free visibility score for researchers. Powered by ORCID and OpenAlex.",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* JSON-LD: Website structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Researchvy",
              description:
                "Researcher Visibility Intelligence Platform — compute and track your academic visibility score.",
              url: process.env["NEXTAUTH_URL"] ?? "https://researchvy.com",
              applicationCategory: "EducationApplication",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            }),
          }}
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
