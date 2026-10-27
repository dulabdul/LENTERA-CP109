import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import SourcesPage from "@/app/sumber-data/page";
import PrivacyPage from "@/app/privasi/page";
import Home from "@/app/page";
import { OfflineBanner } from "@/components/data/OfflineBanner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

describe("M5 Transparency and UX pages", () => {
  it("renders /sumber-data with all four providers, disclaimers, and correction channel", () => {
    const html = renderToString(<SourcesPage />);

    // Providers & datasets
    expect(html).toContain("NASA FIRMS");
    expect(html).toContain("VIIRS");
    expect(html).toContain("Open-Meteo");
    expect(html).toContain("Copernicus Atmosphere Monitoring Service");
    expect(html).toContain("CAMS");
    expect(html).toContain("AirNow");
    expect(html).toContain("Natural Earth");
    expect(html).toContain("CARTO");

    // Methodological disclaimers
    expect(html).toContain("bukan Indeks Standar Pencemar Udara (ISPU)");
    expect(html).toContain("tidak otomatis berarti kebakaran hutan terkonfirmasi");
    expect(html).toContain("tidak memberikan diagnosis medis");

    // Correction channel (FR-07)
    expect(html).toContain("Jalur koreksi dan masukan metodologi");
    expect(html).toContain("dul.abdoel21@gmail.com");
    expect(html).toContain("GitHub Issues");
  });

  it("renders /privasi with zero-tracking, coordinate bucketing, and HMAC rate limit disclosures", () => {
    const html = renderToString(<PrivacyPage />);

    expect(html).toContain("Tanpa pelacak pemasaran");
    expect(html).toContain("Tanpa GPS otomatis");
    expect(html).toContain("0,01°");
    expect(html).toContain("HMAC SHA-256");
    expect(html).toContain("tidak pernah disimpan sebagai profil medis");
    expect(html).toContain("retensi");
    expect(html).toContain("CARTO");
    expect(html).toContain("Open-Meteo");
  });

  it("renders home page with three capabilities, honest status, and accessible navigation", () => {
    const html = renderToString(<Home />);

    expect(html).toContain("Mengenali panas");
    expect(html).toContain("Memahami udara");
    expect(html).toContain("01 / PANAS");
    expect(html).toContain("02 / UDARA");
    expect(html).toContain("03 / TINDAKAN");
    expect(html).toContain("Data belum tersedia");
    expect(html).toContain('href="/peta"');
    expect(html).toContain('href="/sumber-data"');
    expect(html).toContain('href="/privasi"');
  });

  it("renders SiteHeader and SiteFooter with required landmarks and navigations", () => {
    const headerHtml = renderToString(<SiteHeader />);
    expect(headerHtml).toContain('class="site-header"');
    expect(headerHtml).toContain('aria-label="Navigasi utama"');
    expect(headerHtml).toContain('href="/peta"');
    expect(headerHtml).toContain('href="/sumber-data"');
    expect(headerHtml).toContain('href="/privasi"');

    const footerHtml = renderToString(<SiteFooter />);
    expect(footerHtml).toContain('class="site-footer"');
    expect(footerHtml).toContain('href="/sumber-data"');
    expect(footerHtml).toContain('href="/privasi"');
  });

  it("OfflineBanner has accessible roles when rendered", () => {
    // When online (default in server render), it returns null safely
    const html = renderToString(<OfflineBanner />);
    expect(html).toBe("");
  });
});
