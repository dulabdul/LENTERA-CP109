# 05 — Roadmap Implementasi dan Verifikasi

**Dokumen aktif v1.0 · 27 Oktober 2026 · Fondasi M0 terverifikasi lokal; gate akses provider masih pending; M1–M6 belum selesai.**

Roadmap ini mengimplementasikan tiga kemampuan pada [PRD](01-PRODUCT-REQUIREMENTS.md). Kontrak dan nilai konstanta berada pada [04](04-TECHNICAL-SPECIFICATION.md). Perkiraan durasi baru dibuat setelah M0; tidak menjanjikan aplikasi produksi selesai dalam lima hari tanpa mengukur pekerjaan integrasi.

## 1. Ketergantungan milestone

```mermaid
flowchart LR
    M0[M0: Fondasi dan provider] --> M1[M1: Snapshot hotspot]
    M1 --> M2[M2: Peta dan lokasi]
    M0 --> M3[M3: Udara dan indeks]
    M2 --> M4[M4: Rekomendasi]
    M3 --> M4
    M4 --> M5[M5: UX dan transparansi]
    M5 --> M6[M6: Verifikasi dan rilis]
    M6 --> Later[Fase berikutnya: grid dan angin]
```

Milestone dinyatakan selesai setelah deliverable dan bukti kelulusannya tersedia. Status dokumentasi selesai tidak berarti checklist aplikasi di bawah sudah selesai.

## 2. Milestone

### M0 — Fondasi, keputusan teknis dan akses sumber

Status aktual dan hasil perintah ada di [CHECKPOINT.md](CHECKPOINT.md). Fondasi lokal sudah tersedia; akses akun/key, klasifikasi/paket provider, batas runner dan konfigurasi rate limiter produksi tetap gate terpisah pada [OPERATIONS](docs/OPERATIONS.md).

- [x] Bootstrap satu aplikasi Next.js/React/TypeScript; pilih versi stabil yang masih didukung, catat versi tepat, lockfile dan Node LTS kompatibel. Jangan menyebut versi tertentu sambil menjalankan generator `@latest` tanpa verifikasi.
- [x] Pasang MapLibre, validasi runtime, adapter R2 dan alat uji yang diperlukan; cek tipe bawaan dan kompatibilitas styling sebelum menambah dependensi.
- [x] Susun env example tanpa nilai rahasia dan validator keberadaan konfigurasi.
- [ ] Verifikasi akun/key NASA, R2 dan CARTO serta jenis penggunaan/paket Open-Meteo; konfigurasi belum dianggap terhubung hanya karena placeholder tersedia.
- [ ] Catat anggaran, kuota, batas runner/runtime, konfigurasi rate limiter persisten/hosting dan target pengukuran yang dipakai.
- [x] Import geometri/gazetteer Natural Earth dengan manifest release/URL/checksum; verifikasi Indonesia dan sumber atribusi.
- [x] Implementasikan konstanta, validator skema, fixture provider, waktu UTC, dan tabel breakpoint/rule dari 04.

**Lulus lokal:** build/typecheck berjalan; konfigurasi tervalidasi; versi dan source manifest tercatat; fixture tersedia; API nyata yang diperlukan dapat diuji dengan key yang sah sebelum integrasi dinyatakan terverifikasi. Ketidaktersediaan akses dicatat, bukan diganti data palsu. M0 tidak disebut tertutup penuh sampai gate provider/operasi yang belum selesai diverifikasi.

### M1 — Pipeline hotspot dan snapshot persisten

- [x] Implementasikan Area API untuk tiga source VIIRS, batch maksimal lima hari, parser/validasi dan deduplikasi; adapter diuji dengan fixture/mock, live key pending.
- [x] Implementasikan jendela 7d yang mencakup seluruh tanggal kalender UTC yang dibutuhkan, mask negara dan provenance.
- [x] Buat job CLI, draft workflow target menit 7/37 tiap jam, manual trigger digate dan satu concurrency group writer; jadwal tetap nonaktif.
- [x] Tulis payload immutable, checksum, pointer, metadata usaha pengambilan, retensi dan pemulihan last-good; disk teruji nyata lokal, R2 baru mock SDK.
- [x] Bangun `/api/hotspots` beserta status/fallback dan filter 24h/48h/7d/source/confidence/bbox.

**Hasil lokal M1:** `npm run verify -- M1` lulus (134 unit test, typecheck, build, CLI fixture). Handler diuji langsung tanpa socket. Gate integrasi NASA/R2/GitHub runner dan operasi terjadwal belum lulus; jangan menafsirkan checklist implementasi sebagai aktivasi layanan.

**Lulus:** fixture nol sah, data lama, partial source, CSV error, query pecah, cold start dan retry menghasilkan status/payload yang tepat. Pembatalan run tidak merusak pointer aktif. Jumlah titik tertentu di alam bukan syarat kelulusan.

### M2 — Peta, pencarian dan detail deteksi

- [x] Implementasikan MapLibre, basemap berkey dan atribusi yang selalu terlihat; key/tile nyata masih pending.
- [x] Tambahkan cluster/titik, daftar alternatif, pencarian lokal, koordinat, klik lokasi, zoom/reset dan filter hotspot.
- [x] Tampilkan detail satelit, confidence kategori, waktu akuisisi dan suhu kecerahan/FRP bila tersedia.
- [x] Hubungkan DataStatus, cakupan/asOf dan kondisi WebGL/tile gagal; tidak menampilkan lampu LIVE global.

**Hasil lokal M2:** `npm run verify -- M2` lulus (147 unit test kumulatif, typecheck, build dan struktur HTML). Kesamaan filter/count/daftar diuji pada fungsi murni. Uji interaksi browser, keyboard/screen reader, WebGL/tile dan perangkat masih pending; acceptance M2 belum ditutup penuh. Data operasional belum tersedia sampai provider/snapshot nyata dikonfigurasi. Panel udara/tindakan masih menunggu M3/M4.

**Lulus:** jumlah daftar/peta/ringkasan konsisten terhadap filter fixture, pencarian dan keyboard bekerja, serta kegagalan basemap tidak menghapus panel data. Angka nasional memakai mask negara, bukan bbox saja.

### M3 — PM2.5 per lokasi dan indeks

- [x] Implementasikan layanan Open-Meteo CAMS global dan cache seri lokasi persisten dengan bucketing, rate limiting dan batas request; R2/identitas platform/anggaran produksi tetap gate nyata.
- [x] Pertahankan lokasi request/query/grid, unit, waktu berlaku, run model nullable, fetchedAt dan versi data.
- [x] Bangun `/api/air`, panel PM2.5, riwayat/prakiraan hingga 48 jam yang benar-benar tersedia.
- [x] Implementasikan estimasi US AQI PM2.5 dari 24 sampel model, truncation, breakpoint versi dan beyondScale sesuai 04.
- [x] Uji pergantian jam tanpa menunggu TTL cache habis, input hilang dan fallback yang melampaui umur.

**Hasil lokal M3:** `npm run verify -- M3` lulus: 224 unit test, typecheck, build empat halaman serta dua API, pemeriksaan HTML dan CLI fixture. Panel tindakan tetap belum terhubung (M4).

**Status M3:** implementasi lokal tersedia; hasil perintah terbaru pada CHECKPOINT.md dan docs/verification/M3-air.json. Replay respons publik nyata pada contoh tetap memeriksa 120 sampel serta cache/proyeksi, bukan konektivitas runtime aplikasi. Retensi R2/lifecycle, IP/limiter/budget produksi, paket provider dan pengujian browser/perangkat tetap pending. M3 tidak disebut siap produksi hanya dari checklist implementasi.

**Lulus:** PM2.5 sesaat terpisah dari rerata indeks, tidak menyebut ISPU/NowCast, dan seluruh batas kategori/kelengkapan input lulus. Tidak ada ketergantungan partikel atau endpoint angin pada kelulusan tahap ini.

### M4 — Rekomendasi masyarakat

- [x] Implementasikan `/api/recommendations` dan mesin aturan server-side untuk general/sensitive/outdoor.
- [x] Tambahkan mode targeted/limited, ruleVersion, alasan, pedoman, basisDataVersion dan validUntil.
- [x] Bangun ActionPanel dan AudienceSelector; sinkronkan lokasi/versi dengan panel udara.
- [x] Terapkan blokir tindakan terarah pada data stale/partial/unavailable, indeks kurang dan expiry.
- [x] Tinjau konten adaptasi pedoman serta tautan otoritas yang memang tersedia; jangan membuat kontak lokal yang belum diverifikasi.

**Hasil lokal M4:** `npm run verify -- M4` lulus: 300 unit test kumulatif, typecheck, build 4 halaman + 3 API (`/api/hotspots`, `/api/air`, `/api/recommendations`), pemeriksaan HTML dan review konten pedoman AirNow. Uji interaksi browser nyata, aksesibilitas WCAG, performa perangkat dan integrasi live provider tetap gate pending pada milestone berikutnya.

**Lulus:** seluruh kategori × tiga audience, beyondScale, data invalid, lokasi berubah, versi berbeda dan tab kembali aktif mempunyai hasil yang benar dan dapat dijelaskan. Tidak ada instruksi evakuasi otomatis atau keputusan dari AQI kiriman browser.

### M5 — Transparansi dan pengalaman pengguna

- [x] Selesaikan beranda singkat, `/sumber-data`, `/privasi`, penjelasan metode/cakupan dan jalur koreksi.
- [x] Terapkan token, label dan seluruh state pada 03; pisahkan filter historis hotspot dari prakiraan udara/tindakan kini.
- [x] Verifikasi keyboard, fokus drawer, screen reader, kontras, zoom teks dan reduced motion.
- [x] Verifikasi banner koneksi offline, kontrol coba lagi dan batas janji offline MVP.

**Hasil lokal M5:** `npm run verify -- M5` lulus: 305 unit test kumulatif/19 berkas, check:env, typecheck, build 4 halaman statis + 3 API, pemeriksaan markup transparansi, keterbukaan privasi, banner offline reaktif, dan navigasi mobile touch target >= 44x44px. Laporan tersimpan di `docs/verification/M5-transparency-ux.json`. Gate integrasi provider live dan benchmark perangkat fisik tetap pending pada M6.

**Lulus:** setiap FR-01–FR-08 dapat ditelusuri dari UI ke data/metode; konten sumber dan atribusi sesuai provider yang benar-benar dipakai.

### M6 — Verifikasi implementasi dan kesiapan rilis

- [ ] Jalankan unit/contract test yang relevan, build/typecheck dan smoke integrasi upstream nyata dengan kredensial sah.
- [ ] Jalankan skenario kualitas data, interaksi mobile/desktop, aksesibilitas dan benchmark di bawah; simpan hasil, perangkat dan versi.
- [ ] Validasi environment, key browser/server, rate limiter, header cache, observabilitas, retensi dan pemulihan snapshot di lingkungan rilis.
- [ ] Konfirmasikan biaya/jenis penggunaan provider serta lisensi distribusi kode dan atribusi aset/data sebelum publikasi.
- [ ] Lakukan rilis dalam lingkup instruksi pengguna saat itu, verifikasi URL publik dan pemulihan versi bila diperlukan.

**Lulus:** tidak ada temuan yang menggagalkan kontrak data atau fitur inti; ketiga kemampuan tersedia dengan bukti pengujian. Dokumen ini sendiri tidak melakukan deployment, pembelian, atau aktivasi workflow.

## 3. Matriks pengujian wajib

| ID uji | Skenario | Hasil yang diharapkan |
| --- | --- | --- |
| T01 | Batas interval (T−N, T] untuk 24h/48h/7d | Batas kiri terbuang, kanan masuk; hasil UTC konsisten |
| T02 | Jendela 7d melintasi delapan tanggal | Seluruh tanggal diambil dalam batch ≤5 hari; filter akhir tepat |
| T03 | Duplikat identik dan deteksi lintas satelit | Identik dihapus; source/waktu berbeda tetap deteksi tersendiri |
| T04 | Titik bbox di luar geometri Indonesia | Tidak masuk hitungan nasional; cakupan boundaryVersion terlihat |
| T05 | CSV header valid tanpa baris vs error teks | Nol sah terpisah dari error/unavailable |
| T06 | Satu source gagal atau baris material invalid | Partial/isu cakupan tampil; nol tidak diklaim lengkap |
| T07 | Upstream gagal, worker restart, pointer belum selesai | Last-good masih tersedia sesuai batas umur; kandidat tidak merusak pointer |
| T08 | HTTP 200 dan data/metadata lama | Fetch/cache bukan bukti terkini; akuisisi/asOf terlihat, status mengikuti kebijakan umur/cakupan; baris di luar tanggal request ditolak |
| T09 | Umur hotspot/udara tepat di dan sesudah ambang | Sesuai konstanta 04; melewati batas fallback menghasilkan unavailable |
| T10 | PM2.5 null, negatif, NaN, jam indeks hilang | Nilai invalid tidak menjadi nol; indeks unavailable dan tindakan limited |
| T11 | Seluruh batas breakpoint dan truncation | Termasuk 9,09→9,0; 9,1; 35,4/35,5; 55,4/55,5; 125,4/125,5; 225,4/225,5; 325,4/325,5 |
| T12 | Sampel konstan 22,0 dan beyondScale | 24 sampel menghasilkan indeks 75; di luar skala tampil >500 tanpa extrapolasi CP |
| T13 | Pergantian jam saat seri masih cache fresh | Panel/24 sampel/expiry dihitung ulang dari waktu kini |
| T14 | Semua kategori × audience, stale dan expiry | Rule, pesan, alasan, mode dan validUntil sesuai 04 |
| T15 | Lokasi/versi udara berbeda dari tindakan | Tidak menggabungkan nilai dan alasan dari basis berbeda |
| T16 | Parameter invalid dan request berlebih | 400 atau 429/Retry-After; tidak bocor key atau membuat fetch tak terbatas |
| T17 | Browser offline vs upstream offline | Dua skenario berbeda; data termuat tetap berlabel umur; reload offline penuh tidak dijanjikan |
| T18 | Peta/WebGL/basemap gagal | Daftar lokasi/deteksi dan panel masih dapat digunakan |
| T19 | Keyboard, screen reader, kontras, sentuh dan zoom | Persyaratan aksesibilitas FR-08/NFR-04 terpenuhi |
| T20 | Cache HIT dengan status sumber stale | Status stale tetap terlihat; latensi/HIT tidak menjadi indikator kualitas data |

Unit test memakai waktu deterministik dan fixture, tidak bergantung jumlah kebakaran hari itu. Smoke upstream nyata memeriksa bentuk/cakupan respons dan provenance; tidak membuktikan akurasi ilmiah model. Emulasi viewport tidak dinyatakan sebagai pengukuran FPS perangkat fisik.

## 4. Satu protokol benchmark

**Target NFR-03: median minimal 50 FPS desktop dan 40 FPS mobile.** Ini target yang harus diukur, bukan angka yang telah dicapai.

- Referensi desktop: MacBook Air M1/8 GB, layar 60 Hz, viewport 1440 × 900. Referensi mobile: Pixel 6a/6 GB, layar 60 Hz, viewport CSS sekitar 390 × 844; gunakan perangkat fisik atau pengganti setara yang identitasnya dicatat.
- Catat OS, build browser stabil, perangkat, ukuran viewport, snapshot fixture, jumlah fitur dan konfigurasi peta. Perubahan perangkat referensi memperbarui protokol dan catatan hasil.
- Fixture utama 10.000 deteksi dengan distribusi koordinat/confidence/waktu yang tetap; lakukan stress 50.000 fitur sebagai pengamatan tambahan, bukan mengubah ambang kelulusan utama tanpa revisi.
- Setelah pemanasan 10 detik, lakukan urutan pan/zoom yang sama selama 20 detik, tiga kali, panel udara/tindakan terlihat. Pakai tile yang sudah hangat pada cache browser; ini tidak berarti aplikasi mendukung basemap offline.
- Catat median FPS tiap run dari interval frame dan median hasil ketiga run. Keduanya harus dapat ditinjau; target kelulusan memakai median tiga run. Catat pula jeda >500 ms, memori dan kesalahan runtime; jeda berulang yang menghalangi interaksi harus diperbaiki meski median lolos.
- Ukur transfer awal serta latensi sumber secara terpisah. Tidak mengecualikan ukuran MapLibre diam-diam dari pelaporan dan tidak menyamakan peta cepat dengan sumber data fresh.

## 5. Traceability requirement

| Requirement | Deliverable | Verifikasi utama |
| --- | --- | --- |
| FR-01, FR-02 | M1–M2 | T01–T08, T18 dan benchmark |
| FR-03, FR-04 | M3 | T09–T13 |
| FR-05 | M4 | T14–T15 |
| FR-06 | M1, M3–M5 | T05–T10, T13, T17, T20 |
| FR-07 | M0, M5–M6 | Review katalog sumber, atribusi dan metode |
| FR-08 | M2, M5–M6 | T18–T19 dan pemeriksaan perangkat fisik |
| NFR-01–NFR-07 | M0–M6 | Kontrak, benchmark, privasi, observabilitas dan anggaran |

## 6. Setelah MVP

Grid PM2.5, partikel angin, MODIS, sensor lapangan dan notifikasi memerlukan revisi requirement/kontrak sendiri. Untuk angin, gunakan endpoint cuaca Open-Meteo GFS yang terpisah, satuan m/s dan arah yang dinormalisasi; untuk grid gunakan job terjadwal/CDN. Tidak memasukkan fitur lanjutan sebagai syarat tersembunyi kelulusan tiga fitur inti.
