# Instruksi agen — Lentera Karhutla

## Mulai atau lanjutkan pekerjaan

1. Baca `CHECKPOINT.md` terlebih dahulu. Baca checkpoint immutable terakhir yang ditautkan di sana dan `docs/DECISIONS.md`.
2. Gunakan `01-PRODUCT-REQUIREMENTS.md` untuk scope, `04-TECHNICAL-SPECIFICATION.md` untuk kontrak, dan `05-IMPLEMENTATION-ROADMAP.md` untuk milestone.
3. Periksa berkas aktual sebelum melanjutkan; checkpoint merekam keadaan pada waktu tertentu dan dapat tertinggal jika proses terputus di tengah perubahan.
4. Pengguna meminta checkpoint setiap fase agar pekerjaan dapat dilanjutkan AI agent lain. Perbarui checkpoint setelah perubahan bermakna, sebelum operasi panjang, dan sebelum mengakhiri sesi. Jangan hanya menyimpan kemajuan dalam chat.

## Aturan implementasi

- Kerjakan aplikasi lokal pada repo ini sesuai arsitektur Next.js yang disepakati. Jangan mengganti stack atau mendaftarkan/publikasi hosting tanpa lingkup instruksi yang sesuai.
- Tiga fitur inti: hotspot, PM2.5/kualitas udara, dan rekomendasi tindakan. Grid/angin adalah fase berikutnya.
- Data fixture harus jelas sintetis; jangan menyatakannya sebagai kondisi terkini. Kredensial atau integrasi yang belum diuji tetap dicatat pending.
- Jangan menyimpan nilai rahasia dalam checkpoint, log, snapshot, source control, atau output. `.env.example` hanya berisi placeholder.
- Pertahankan bukti studi `research/2026-10-27-mandum-rimba`; jangan memakai endpoint situs referensi sebagai upstream.
- Catat keputusan teknis dan deviasi dari spesifikasi di `docs/DECISIONS.md`. Jangan menandai milestone lulus hanya karena scaffold dibuat.
- Jalankan pemeriksaan yang relevan dan simpan perintah/hasil pada checkpoint. Bedakan pemeriksaan dokumen, unit test, build, integrasi nyata dan pengukuran browser/perangkat.

## Handoff

`CHECKPOINT.md` harus memuat: fase/subfase, status, hasil yang telah diverifikasi, keterbatasan, file penting, perintah melanjutkan, dan langkah berikutnya yang konkret. Checkpoint bukan permintaan persetujuan untuk setiap langkah rutin; lanjutkan pekerjaan yang telah diinstruksikan pengguna.
