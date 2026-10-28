import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { OfflineBanner } from "@/components/data/OfflineBanner";
import { publicThemeBootstrap } from "@/components/theme/public-theme";
import "./globals.css";
import "./ui-redesign.css";
import "./hero.css";
import "./public-themes.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cp-109.panel-arvello.space";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LENTERA — Panas, Udara, dan Rekomendasi Karhutla",
    template: "%s | LENTERA",
  },
  description:
    "Observatorium deteksi titik panas satelit NASA VIIRS, estimasi kualitas udara PM2.5 per lokasi, dan rekomendasi mitigasi kesehatan masyarakat Indonesia.",
  applicationName: "LENTERA Karhutla",
  authors: [{ name: "Tim Pengembang LENTERA", url: siteUrl }],
  generator: "Next.js",
  keywords: [
    "karhutla",
    "kebakaran hutan dan lahan",
    "hotspot indonesia",
    "titik panas",
    "kualitas udara indonesia",
    "PM2.5",
    "ISPU",
    "AQI Indonesia",
    "NASA FIRMS",
    "VIIRS",
    "pantau karhutla",
    "kabut asap",
    "rekomendasi polusi udara",
    "bencana asap",
  ],
  creator: "LENTERA Karhutla",
  publisher: "LENTERA Karhutla",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
    languages: {
      "id-ID": "/",
    },
  },
  openGraph: {
    title: "LENTERA — Mengenali Panas, Memahami Udara",
    description:
      "Observatorium deteksi titik panas satelit NASA VIIRS, estimasi kualitas udara PM2.5 per lokasi, dan panduan mitigasi kesehatan masyarakat Indonesia.",
    url: siteUrl,
    siteName: "LENTERA Karhutla",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LENTERA Karhutla — Mengenali Panas, Memahami Udara (Hero Section Observatory)",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LENTERA — Mengenali Panas, Memahami Udara",
    description:
      "Observatorium deteksi titik panas satelit NASA VIIRS, estimasi kualitas udara PM2.5 per lokasi, dan panduan mitigasi kesehatan masyarakat Indonesia.",
    images: ["/og-image.png"],
    creator: "@lenterakarhutla",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon.svg" },
    ],
  },
  category: "environment",
  classification: "Environmental Monitoring & Public Health",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      "url": siteUrl,
      "name": "LENTERA",
      "alternateName": ["Lentera Karhutla", "Observatorium Karhutla Indonesia"],
      "description":
        "Observatorium deteksi titik panas satelit NASA VIIRS dan kualitas udara PM2.5 Indonesia.",
      "inLanguage": "id-ID",
      "publisher": {
        "@type": "Organization",
        "name": "LENTERA Karhutla",
        "url": siteUrl,
        "logo": {
          "@type": "ImageObject",
          "url": `${siteUrl}/og-image.png`,
        },
      },
    },
    {
      "@type": "GovernmentService",
      "@id": `${siteUrl}/#service`,
      "name": "Pemantauan Hotspot & Kualitas Udara Karhutla",
      "serviceType": "Environmental Monitoring",
      "provider": {
        "@type": "Organization",
        "name": "LENTERA Karhutla",
      },
      "areaServed": {
        "@type": "Country",
        "name": "Indonesia",
      },
      "description":
        "Layanan informasi publik terbuka untuk pemantauan anomali radiasi termal satelit dan kualitas udara ambien.",
    },
    {
      "@type": "Dataset",
      "@id": `${siteUrl}/#dataset`,
      "name": "Deteksi Hotspot Satelit & Model PM2.5 Indonesia",
      "description":
        "Kompilasi data terbuka deteksi satelit NASA FIRMS VIIRS dan model dispersi atmosferik CAMS ECMWF untuk wilayah Indonesia.",
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "spatialCoverage": "Indonesia",
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-public-theme="dark" suppressHydrationWarning>
      <head>
        <script id="public-theme-init" dangerouslySetInnerHTML={{ __html: publicThemeBootstrap }} />
        <script
          id="schema-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">Langsung ke konten</a>
        <OfflineBanner />
        <div className="site-shell">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
