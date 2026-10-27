# Checkpoint kerja — Lentera Karhutla

Terakhir diperbarui: **2026-10-27T18:48:54.591Z**. Fase aktif: **M6**. Status: **local-verified-runtime-production-browser-gates-pending**.

## Baca ini jika berganti AI agent

Pengguna menginstruksikan implementasi dengan checkpoint setiap fase. Baca AGENTS.md, checkpoint immutable di bawah, docs/DECISIONS.md dan kontrak 04 sebelum bekerja. Periksa berkas aktual dan proses yang mungkin masih berjalan; jangan mengasumsikan pekerjaan setelah timestamp ini sudah selesai.

## Hasil fase ini

Fase M6 (Verifikasi implementasi dan kesiapan rilis) selesai dan terverifikasi lokal: Seluruh fitur MVP FR-01 hingga FR-08 dan NFR-01 hingga NFR-07 terverifikasi secara lokal. 305 unit test di 19 berkas lulus 100%, typecheck bebas error, build Next.js 4 halaman statis + 3 dynamic route API berhasil. Uji pemulihan arsip mandiri (M6-handoff-recovery.json) memvalidasi 154 file SHA-256 tanpa kebocoran build/rahasia. Audit kesiapan rilis tercatat di docs/verification/M6-release-readiness.json. Gate live provider dan benchmark FPS perangkat fisik tetap pending.

## Verifikasi yang tercatat

npm run verify -- M6 lulus: 305 unit test/19 berkas, typecheck, build 4 halaman statis + 3 dynamic API, pemeriksaan HTML, fixture ingest, dan audit kesiapan rilis. Uji pemulihan arsip M6-handoff-recovery.json lulus 154 file checksum SHA-256.

## Langkah berikutnya

Proyek Lentera Karhutla telah mencapai kesiapan rilis lokal penuh (M0–M6 terverifikasi lokal). Untuk melanjutkan bagi AI Agentic berikutnya: 1. Masukkan kredensial sah di .env.local untuk live integration test (NASA FIRMS, Cloudflare R2, CARTO). 2. Jalankan benchmark FPS perangkat fisik (MacBook M1 & Pixel 6a) sesuai protokol dokumen 05. 3. Konfigurasi Vercel deployment dan verifikasi IP header tepercaya.

## Milestone

| Fase | Status terakhir |
| --- | --- |
| M0 | local-verified-provider-gates-pending |
| M1 | local-verified-provider-gates-pending |
| M2 | local-verified-browser-provider-gates-pending |
| M3 | local-verified-runtime-production-browser-gates-pending |
| M4 | local-verified-runtime-production-browser-gates-pending |
| M5 | local-verified-runtime-production-browser-gates-pending |
| M6 | local-verified-runtime-production-browser-gates-pending |

## Berkas handoff

- [Checkpoint immutable](docs/checkpoints/M6-01-handoff-ready.md)
- [Manifest dan checksum](docs/checkpoints/M6-01-handoff-ready.json)
- [Arsip source tanpa dependency/rahasia](docs/checkpoints/M6-01-handoff-ready.zip)
- [Keputusan implementasi](docs/DECISIONS.md)
- [Setup lokal](docs/SETUP.md)
- [Kontrak teknis](04-TECHNICAL-SPECIFICATION.md)

Perintah standar setelah dependency terpasang: npm test; npm run typecheck; npm run build. Perintah checkpoint: npm run checkpoint -- --id M0-02-nama --phase M0 --status in-progress --summary 'hasil' --next 'langkah berikutnya' --validation 'perintah dan hasil aktual'. Gunakan ID baru; jangan menimpa checkpoint lama.

Nilai API key tidak disimpan di checkpoint. Ketiadaan key/akses provider harus dicatat pending, tidak diganti data sintetis yang mengaku nyata. Tidak ada deployment atau aktivasi cloud yang tersirat dari checkpoint source lokal.
