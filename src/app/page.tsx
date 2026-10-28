import type { Metadata } from "next";
import Link from "next/link";
import { DataStatus } from "@/components/data/DataStatus";
import { HeroMapIllustration } from "@/components/public/HeroMapIllustration";

export const metadata: Metadata = {
  title: "LENTERA — Mengenali Panas, Memahami Udara",
  description:
    "Platform pemantauan lingkungan karhutla Indonesia. Pantau anomali radiasi termal satelit NASA VIIRS, estimasi sebaran PM2.5 24 jam, dan panduan mitigasi kesehatan udara.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <main id="main" className="home-page">
      <section className="hero hero-observatory" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow"><span aria-hidden="true" />PEMANTAUAN LINGKUNGAN INDONESIA</p>
          <h1 id="hero-heading">
            Mengenali panas.<br />
            <em>Memahami udara.</em>
          </h1>
          <p className="hero-description">
            Lihat deteksi panas satelit, pahami kualitas udara PM2.5 per lokasi, dan temukan rekomendasi tindakan yang relevan untuk masyarakat.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/peta">
              Pantau lokasi sekarang <span aria-hidden="true">↗</span>
            </Link>
            <Link className="secondary-link" href="/sumber-data">
              Pelajari metodologi <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <p className="quiet-note">
            Sumber Data Terbuka.
          </p>
        </div>

        <HeroMapIllustration />
      </section>

      <section className="availability" aria-label="Status ketersediaan layanan">
        <DataStatus state="unavailable">
          Data belum tersedia secara operasional. Konfigurasi integrasi live provider masih pending; tidak ada angka kondisi terkini yang ditampilkan tanpa verifikasi.
        </DataStatus>
      </section>

      <div className="overview-heading"><p className="eyebrow">TIGA PILAR / SATU KONTEKS</p><h2>Informasi yang saling melengkapi.</h2></div>
      <section className="feature-list" aria-label="Tiga pilar informasi Lentera Karhutla">
        <article>
          <span className="feature-number">01 / PANAS</span>
          <div>
            <h2>Deteksi yang bisa diperiksa.</h2>
            <p>
              Lokasi, satelit VIIRS, tingkat keyakinan (rendah/nominal/tinggi), dan waktu pengamatan UTC/WIB. Titik panas adalah anomali termal, bukan konfirmasi langsung kebakaran di lapangan.
            </p>
            <Link href="/peta" className="feature-link">Buka peta hotspot →</Link>
          </div>
          <span className="feature-stage">Pemantauan hotspot</span>
        </article>

        <article>
          <span className="feature-number">02 / UDARA</span>
          <div>
            <h2>Kondisi dengan konteks.</h2>
            <p>
              PM2.5 (µg/m³) per lokasi dan estimasi US AQI dari rerata model CAMS 24 jam dengan breakpoint EPA 2024. Model atmosfer ditampilkan transparan bersama jam berlaku dan keterbatasannya.
            </p>
            <Link href="/peta" className="feature-link">Periksa kualitas udara →</Link>
          </div>
          <span className="feature-stage">PM2.5 & kualitas udara</span>
        </article>

        <article>
          <span className="feature-number">03 / TINDAKAN</span>
          <div>
            <h2>Langkah yang punya alasan.</h2>
            <p>
              Pedoman tindakan adaptasi resmi AirNow untuk masyarakat umum, kelompok sensitif, dan pelaku aktivitas luar ruang, dengan penanda masa berlaku serta alasan keterbatasan yang jelas.
            </p>
            <Link href="/peta" className="feature-link">Lihat panduan tindakan →</Link>
          </div>
          <span className="feature-stage">Rekomendasi masyarakat</span>
        </article>
      </section>

      <section className="summary-banner" aria-label="Prinsip keterbukaan data">
        <div className="summary-content">
          <h3>Komitmen Transparansi Data</h3>
          <p>
            Lentera Karhutla tidak menyamakan ketiadaan sensor dengan udara bersih, tidak menyamakan titik panas dengan kebakaran pasti, dan tidak menggunakan data usang tanpa penanda kedaluwarsa.
          </p>
        </div>
        <div className="summary-links">
          <Link href="/sumber-data" className="control-link">Baca metode & sumber ↗</Link>
          <Link href="/privasi" className="control-link">Kebijakan privasi ↗</Link>
        </div>
      </section>
    </main>
  );
}
