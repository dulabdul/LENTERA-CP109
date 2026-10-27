import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { OfflineBanner } from "@/components/data/OfflineBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lentera Karhutla — Panas, udara, dan tindakan", template: "%s | Lentera Karhutla" },
  description: "Informasi deteksi hotspot, PM2.5 model, dan tindakan masyarakat dengan sumber dan waktu data yang dapat diperiksa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
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
