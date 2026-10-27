# Lentera Karhutla — Dokumen Produk dan Implementasi

**Versi dokumen 1.0 · Status 28 Oktober 2026: pipeline hotspot, UI monitoring dan modul udara M0–M3 tersedia dengan verifikasi lokal. Integrasi produksi/browser dan M4–M6 belum selesai.**

Lentera Karhutla adalah layanan informasi publik untuk membantu masyarakat melihat **deteksi hotspot, PM2.5/kualitas udara, dan tindakan yang relevan untuk lokasi pilihannya**. Implementasi, identitas visual, dan konten aplikasi ditulis sendiri. Mandum Rimba dipakai sebagai bahan studi teknik, bukan upstream produksi atau template yang disalin.

## Melanjutkan eksekusi / ganti AI agent

Baca **[CHECKPOINT.md](CHECKPOINT.md)** terlebih dahulu, lalu [AGENTS.md](AGENTS.md), [keputusan implementasi](docs/DECISIONS.md), dan [setup lokal](docs/SETUP.md). Setiap checkpoint memuat status nyata, hasil verifikasi, langkah berikutnya, checksum, dan arsip source yang mengecualikan rahasia/dependency. Keadaan aplikasi tidak disimpulkan dari checklist dokumentasi.

Perintah lokal: `npm ci`, `npm run verify`, lalu `npm run dev`. Key/akses provider yang belum tersedia tetap dicatat pending pada [operasi](docs/OPERATIONS.md). Shell awal memakai data geografis nyata, tetapi tidak menampilkan deteksi/PM2.5 sintetis sebagai kondisi kini.

## Tiga kemampuan inti

1. **Pemantauan hotspot:** peta nasional deteksi VIIRS, detail sensor/waktu/confidence, filter 24h/48h/7d, dan pencarian lokasi.
2. **PM2.5/kualitas udara:** konsentrasi model CAMS per lokasi, prakiraan hingga 48 jam bila tersedia, dan estimasi US AQI PM2.5 dari rerata bergerak 24 jam.
3. **Rekomendasi tindakan masyarakat:** aturan berversi, alasan rekomendasi, pilihan kelompok pengguna, sumber pedoman, dan status kesegaran data.

Beranda dan halaman metodologi mendukung ketiga kemampuan tersebut. Grid PM2.5 penuh, animasi angin, notifikasi, dan integrasi sensor lapangan masuk pengembangan berikutnya.

## Indeks dan tanggung jawab dokumen

| Dokumen | Menetapkan |
| --- | --- |
| [01 — PRD](01-PRODUCT-REQUIREMENTS.md) | Tujuan, pengguna, scope MVP, requirement dan kriteria keberhasilan produk |
| [02 — Arsitektur](02-ARCHITECTURE-DESIGN.md) | Aliran provider, scheduler, object storage, API, cache, dan pemulihan |
| [03 — UI/UX](03-UI-UX-DESIGN-SYSTEM.md) | Alur lokasi, peta, panel udara/tindakan, label, warna dan state data |
| [04 — Spesifikasi teknis](04-TECHNICAL-SPECIFICATION.md) | Kontrak tipe/API, konstanta operasional, algoritma waktu/indeks, dan aturan tindakan |
| [05 — Roadmap](05-IMPLEMENTATION-ROADMAP.md) | Milestone dan verifikasi setiap requirement sebelum rilis |
| [06 — Analisis referensi](06-MANDUM-RIMBA-ANALYSIS.md) | Bukti pemeriksaan Mandum Rimba pada 27 Oktober dan pelajaran teknik |
| [07 — Audit penyelarasan](07-DOCUMENT-ALIGNMENT-AUDIT.md) | Penutupan temuan audit, keputusan lintas dokumen dan batas verifikasi |

Dokumen 01–05 adalah spesifikasi aktif. Bagian observasi dalam 06 adalah catatan historis; temuan pada situs referensi tidak dianggap sebagai fitur yang sudah diimplementasikan di Lentera. Detail kontrak dan konstanta hanya didefinisikan secara kanonis pada 04, lalu dirujuk dokumen lain. Perubahan requirement harus diperbarui pada seluruh dokumen yang terdampak.

## Keputusan MVP

| Bidang | Keputusan |
| --- | --- |
| Stack | Satu aplikasi Next.js App Router, React, TypeScript dan MapLibre; versi tepat telah dipin pada package.json/lockfile; detail keputusan M0 pada docs/DECISIONS.md |
| Hosting awal | Web/API Node.js di Vercel; object storage Cloudflare R2; job Node.js pada GitHub Actions terjadwal |
| Hotspot | NASA FIRMS **Area API**, tiga sumber VIIRS NRT; route publik `/api/hotspots` |
| Udara | Open-Meteo Air Quality, domain CAMS global; route `/api/air`; PM2.5 adalah model, bukan sensor darat |
| Indeks | `Estimasi US AQI PM2.5 — rerata model 24 jam`; bukan ISPU resmi, AQI gabungan, atau NowCast |
| Tindakan | Evaluasi server-side pada `/api/recommendations`, tanpa LLM; tidak menerima angka AQI dari browser sebagai dasar keputusan |
| Wilayah | Hotspot dalam batas indikatif Indonesia dari Natural Earth; pencarian lokal dan klik peta untuk memilih lokasi |
| Data | Snapshot persisten dan status `ok`, `stale`, `partial`, `unavailable`; data hilang tidak berubah menjadi nol |
| Biaya | Target biaya rendah dengan pemantauan kuota; tidak menjanjikan Rp0 atau menganggap paket gratis cocok untuk setiap jenis penggunaan |

## Status pekerjaan

- [x] Analisis referensi dan arsip bukti.
- [x] Penyelarasan PRD, arsitektur, UI/UX, spesifikasi, dan roadmap.
- [x] Fondasi lokal: bootstrap, versi dipin, geografi, policy/validator, metode indeks dan aturan, fixture serta verifikasi lokal.
- [ ] Validasi akses provider, paket/kuota/rate limiter dan konfigurasi cloud untuk integrasi nyata.
- [x] Pipeline hotspot lokal: parser, snapshot/pemulihan, CLI dan API; 134 unit test, typecheck, build dan CLI fixture lulus. Integrasi NASA/R2 nyata tetap pending.
- [x] UI monitoring M2: peta/cluster, pencarian, filter, daftar/detail dan state koneksi; verifikasi lokal kumulatif 147 unit test, typecheck/build/struktur HTML. Interaksi browser, tile dan FPS belum diverifikasi.
- [x] Modul udara M3: adapter CAMS, cache/fallback/lease, limiter/anggaran persisten, API, panel PM2.5/indeks/riwayat/prakiraan. Bukti respons nyata direplay melalui cache sementara; konektivitas runtime/produksi dan browser tetap pending. Hasil verifikasi terbaru pada CHECKPOINT.md.
- [ ] Implementasi tiga fitur inti dan pengujian.
- [ ] Konfigurasi akun/key, pemeriksaan biaya, dan rilis.

Teks kesehatan mengikuti sumber pedoman yang disebut di 04 dan harus melalui pemeriksaan konten sebelum rilis. Sumber data, library, basemap dan font tetap mempunyai ketentuan masing-masing; lisensi kode asli Lentera tidak menghapus ketentuan tersebut. Lisensi distribusi kode diputuskan pemilik proyek sebelum publikasi.

Bukti pemeriksaan referensi ada di [research/2026-10-27-mandum-rimba/evidence.json](research/2026-10-27-mandum-rimba/evidence.json). Versi delapan dokumen sebelum revisi tersimpan dalam [arsip sebelum penyelarasan](research/2026-10-27-document-alignment/before-alignment.zip) dengan [manifest checksum](research/2026-10-27-document-alignment/before-manifest.json).
