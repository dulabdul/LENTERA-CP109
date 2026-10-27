# Checkpoint kerja — Lentera Karhutla

Terakhir diperbarui: **2026-10-27T18:41:32.995Z**. Fase aktif: **M5**. Status: **local-verified-runtime-production-browser-gates-pending**.

## Baca ini jika berganti AI agent

Pengguna menginstruksikan implementasi dengan checkpoint setiap fase. Baca AGENTS.md, checkpoint immutable di bawah, docs/DECISIONS.md dan kontrak 04 sebelum bekerja. Periksa berkas aktual dan proses yang mungkin masih berjalan; jangan mengasumsikan pekerjaan setelah timestamp ini sudah selesai.

## Hasil fase ini

Fase M5 (Transparansi dan pengalaman pengguna) selesai dan terverifikasi lokal: Halaman /sumber-data dilengkapi rincian teknis 4 provider upstream (NASA FIRMS Area API VIIRS, Open-Meteo CAMS Global PM2.5, US EPA AirNow, Natural Earth) beserta pembeda model vs sensor/ISPU dan saluran pelaporan koreksi data via GitHub Issues/email. Halaman /privasi menetapkan prinsip zero-tracking tanpa cookie periklanan/analitik, bucketing teknis 0,01° tanpa GPS otomatis, HMAC SHA-256 rate limiter, dan ketiadaan profil medis audiens. Komponen OfflineBanner mendeteksi koneksi terputus secara reaktif dengan role status aksesibel. Navigasi pintas mobile (mobile-section-nav) dan kontrol sentuh >= 44x44px diterapkan. Keputusan D014 tersimpan.

## Verifikasi yang tercatat

npm run verify -- M5 lulus: 305 unit test/19 berkas, check:env, typecheck, build 4 halaman statis + 3 dynamic API, validasi markup transparansi sumber data, pengungkapan privasi, banner offline, dan navigasi mobile. Laporan tersimpan di docs/verification/M5-transparency-ux.json. Uji browser fisik, aksesibilitas WCAG, performa perangkat dan integrasi live provider tetap pending pada M6.

## Langkah berikutnya

Fase M5 selesai secara lokal. Lanjutkan ke Fase M6 (Verifikasi implementasi dan kesiapan rilis): integrasi upstream nyata dengan kredensial sah jika tersedia, pengukuran benchmark FPS desktop/mobile (NFR-03: 50 FPS desktop, 40 FPS mobile) pada browser fisik/perangkat acuan, validasi rate limiter di lingkungan rilis, dan final checklist sebelum publikasi.

## Milestone

| Fase | Status terakhir |
| --- | --- |
| M0 | local-verified-provider-gates-pending |
| M1 | local-verified-provider-gates-pending |
| M2 | local-verified-browser-provider-gates-pending |
| M3 | local-verified-runtime-production-browser-gates-pending |
| M4 | local-verified-runtime-production-browser-gates-pending |
| M5 | local-verified-runtime-production-browser-gates-pending |
| M6 | not-started |

## Berkas handoff

- [Checkpoint immutable](docs/checkpoints/M5-01-local-verified.md)
- [Manifest dan checksum](docs/checkpoints/M5-01-local-verified.json)
- [Arsip source tanpa dependency/rahasia](docs/checkpoints/M5-01-local-verified.zip)
- [Keputusan implementasi](docs/DECISIONS.md)
- [Setup lokal](docs/SETUP.md)
- [Kontrak teknis](04-TECHNICAL-SPECIFICATION.md)

Perintah standar setelah dependency terpasang: npm test; npm run typecheck; npm run build. Perintah checkpoint: npm run checkpoint -- --id M0-02-nama --phase M0 --status in-progress --summary 'hasil' --next 'langkah berikutnya' --validation 'perintah dan hasil aktual'. Gunakan ID baru; jangan menimpa checkpoint lama.

Nilai API key tidak disimpan di checkpoint. Ketiadaan key/akses provider harus dicatat pending, tidak diganti data sintetis yang mengaku nyata. Tidak ada deployment atau aktivasi cloud yang tersirat dari checkpoint source lokal.
