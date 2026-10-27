import Link from "next/link";
import { DataStatus } from "@/components/data/DataStatus";
import { indonesiaPreviewPaths } from "@/lib/geography";

export default function Home() {
  return <main id="main">
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">INDONESIA / OBSERVATORIUM LINGKUNGAN</p><h1>Mengenali panas.<br /><em>Memahami udara.</em></h1><p className="hero-description">Lihat deteksi panas, pahami kualitas udara, dan temukan langkah yang relevan untuk lokasi Anda.</p><Link className="primary-link" href="/peta">Pantau lokasi <span aria-hidden="true">↗</span></Link><p className="quiet-note">Sumber terbuka. Waktu data jelas. Tanpa klaim yang melampaui bukti.</p></div>
      <div className="geography-preview"><div className="map-caption"><span>KEPULAUAN INDONESIA</span><span>94,5° E — 141,5° E</span></div><svg viewBox="0 0 1000 430" role="img" aria-label="Gambaran batas indikatif kepulauan Indonesia, tanpa data deteksi hotspot"><defs><pattern id="grid" width="100" height="86" patternUnits="userSpaceOnUse"><path d="M100 0H0V86" fill="none" stroke="#344050" strokeWidth="0.7" /></pattern></defs><rect width="1000" height="430" fill="url(#grid)" />{indonesiaPreviewPaths().map((path, index) => <path key={index} d={path} fill="#344737" stroke="#7F9B80" strokeWidth="0.7" />)}</svg><div className="map-caption"><span>BATAS INDIKATIF · NATURAL EARTH</span><span>Konteks geografis, tanpa data kondisi kini</span></div></div>
    </section>
    <section className="availability"><DataStatus state="unavailable">Data operasional belum terhubung. Tidak ada angka kondisi kini yang ditampilkan.</DataStatus></section>
    <section className="feature-list" aria-label="Tiga kemampuan Lentera">
      <article><span className="feature-number">01 / PANAS</span><div><h2>Deteksi yang bisa diperiksa.</h2><p>Lokasi, satelit, tingkat keyakinan, dan waktu pengamatan. Satu titik panas tidak otomatis berarti kebakaran terkonfirmasi.</p></div><span className="feature-stage">Pemantauan hotspot</span></article>
      <article><span className="feature-number">02 / UDARA</span><div><h2>Kondisi dengan konteks.</h2><p>PM2.5 per lokasi dan estimasi indeks dengan periode yang jelas. Data model ditampilkan bersama sumber serta keterbatasannya.</p></div><span className="feature-stage">PM2.5 & kualitas udara</span></article>
      <article><span className="feature-number">03 / TINDAKAN</span><div><h2>Langkah yang punya alasan.</h2><p>Informasi tindakan masyarakat mengikuti pedoman yang dapat ditelusuri, kelompok pengguna, dan kesegaran data.</p></div><span className="feature-stage">Rekomendasi masyarakat</span></article>
    </section>
  </main>;
}
