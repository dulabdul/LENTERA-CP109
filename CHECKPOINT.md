# Checkpoint kerja — Lentera Karhutla

Terakhir diperbarui: **2026-10-27T18:28:12.697Z**. Fase aktif: **M4**. Status: **local-verified-runtime-production-browser-gates-pending**.

## Baca ini jika berganti AI agent

Pengguna menginstruksikan implementasi dengan checkpoint setiap fase. Baca AGENTS.md, checkpoint immutable di bawah, docs/DECISIONS.md dan kontrak 04 sebelum bekerja. Periksa berkas aktual dan proses yang mungkin masih berjalan; jangan mengasumsikan pekerjaan setelah timestamp ini sudah selesai.

## Hasil fase ini

Rekomendasi masyarakat (Fase M4) selesai dan terverifikasi lokal: GET /api/recommendations berbasis AirService dan shared limiter, katalog aturan server-only LK-AIR-*-v1 (6 kategori AQI x 3 audience: general, sensitive, outdoor) serta fallback LK-DATA-LIMITED-v1. Panel tindakan ActionPanel dan AudienceSelector terintegrasi dalam LocationPanels di /peta, dengan pembatalan siklus IO usang via AbortController, auto-retry 1x saat disparitas basis dataVersion, clock monotonik dan timer kedaluwarsa otomatis. Keputusan arsitektur D013 dan review editorial pedoman AirNow tersimpan.

## Verifikasi yang tercatat

npm run verify -- M4 lulus: 300 unit test/18 berkas, check:env, typecheck, build 4 halaman statis + 3 API (/api/hotspots, /api/air, /api/recommendations), pemeriksaan HTML dan fixture ingest hotspot. Review konten tersimpan di docs/verification/M4-content-review.json. Uji browser fisik, aksesibilitas WCAG, performa perangkat dan integrasi live provider tetap pending.

## Langkah berikutnya

Fase M4 selesai secara lokal. Lanjutkan ke Fase M5 (Transparansi dan pengalaman pengguna): halaman beranda /, /sumber-data, /privasi, typography, drawer/responsivitas mobile, verifikasi aksesibilitas WCAG (keyboard, screen reader, kontras, reduced motion), dan banner offline sebelum benchmark M6.

## Milestone

| Fase | Status terakhir |
| --- | --- |
| M0 | local-verified-provider-gates-pending |
| M1 | local-verified-provider-gates-pending |
| M2 | local-verified-browser-provider-gates-pending |
| M3 | local-verified-runtime-production-browser-gates-pending |
| M4 | local-verified-runtime-production-browser-gates-pending |
| M5 | not-started |
| M6 | not-started |

## Berkas handoff

- [Checkpoint immutable](docs/checkpoints/M4-03-local-verified.md)
- [Manifest dan checksum](docs/checkpoints/M4-03-local-verified.json)
- [Arsip source tanpa dependency/rahasia](docs/checkpoints/M4-03-local-verified.zip)
- [Keputusan implementasi](docs/DECISIONS.md)
- [Setup lokal](docs/SETUP.md)
- [Kontrak teknis](04-TECHNICAL-SPECIFICATION.md)

Perintah standar setelah dependency terpasang: npm test; npm run typecheck; npm run build. Perintah checkpoint: npm run checkpoint -- --id M0-02-nama --phase M0 --status in-progress --summary 'hasil' --next 'langkah berikutnya' --validation 'perintah dan hasil aktual'. Gunakan ID baru; jangan menimpa checkpoint lama.

Nilai API key tidak disimpan di checkpoint. Ketiadaan key/akses provider harus dicatat pending, tidak diganti data sintetis yang mengaku nyata. Tidak ada deployment atau aktivasi cloud yang tersirat dari checkpoint source lokal.
