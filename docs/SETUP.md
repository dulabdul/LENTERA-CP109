# Setup dan melanjutkan implementasi

1. Baca `../CHECKPOINT.md` dan `DECISIONS.md`; jangan mengandalkan riwayat chat.
2. Gunakan Node.js 22 LTS yang kompatibel dengan `package.json`, atau Node 24 LTS. Manifest versi dipin; gunakan npm dan lockfile yang tersedia.
3. Jalankan `npm ci` jika lockfile sudah tersedia; jika bootstrap belum menghasilkan lockfile, lanjutkan hambatan instalasi pada checkpoint sebelum menyatakan setup selesai.
4. Salin `.env.example` menjadi `.env.local` hanya saat mengisi konfigurasi. Jangan memasukkan file environment ke checkpoint.
5. Perintah verifikasi lengkap: `npm run verify` (menyimpan laporan/log). Perintah terpisah: `npm test`, `npm run typecheck`, `npm run build`. Pengujian provider nyata berbeda dari fixture lokal.
6. Jalankan `npm run dev` untuk aplikasi lokal. Akses yang belum diimplementasikan harus terlihat tidak tersedia.

## Checkpoint setiap fase

Contoh (gunakan ID baru dan hasil nyata):

```bash
npm run checkpoint -- --id M0-02-foundation-verified --phase M0 --status local-verified --summary 'Hasil yang benar-benar selesai' --next 'Langkah konkret berikutnya' --validation 'Perintah verifikasi dan hasilnya'
```

Script menghasilkan checkpoint Markdown/JSON immutable, checksum source, arsip source yang mengecualikan rahasia/dependency, dan memperbarui `CHECKPOINT.md`. Jangan menganggap status local-verified berarti akses cloud telah terverifikasi; tulis keterbatasannya secara eksplisit.

## Jaringan terbatas pada sesi awal

Pada sesi bootstrap, npm mengalami ENOTFOUND untuk registry di sandbox sementara curl dapat mengunduh registry. Paket sedang diunduh dari registry resmi dan akan dipasang offline setelah integrity tarball diperiksa. Cache sementara: `/tmp/lentera-npm-cache`, metadata/tarball `/tmp/lentera-registry`. Agen pada mesin lain dapat memakai `npm ci` dengan jaringan normal setelah lockfile tersedia.

Tidak ada pemindahan API key dari proyek lain. NASA, R2 dan CARTO harus dikonfigurasi untuk proyek ini saat integrasi nyata dikerjakan.


## Reproduksi impor geografi (opsional)

Data turunannya sudah disertakan di src/data; tidak perlu mengunduh ulang untuk menjalankan aplikasi atau test. Untuk mereproduksi impor:

```bash
mkdir -p .cache/geography
curl -fL https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip -o .cache/geography/countries.zip
curl -fL https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_populated_places.zip -o .cache/geography/places.zip
python3 scripts/unpack-geography.py
npm run import:geography
```

Bandingkan checksum/release dengan manifest sebelum memperbarui aset. Archive upstream dapat berubah di masa depan; perubahan versi harus dicatat, tidak ditimpa diam-diam.

## Handoff ke agen lain

Berikan folder proyek atau arsip source checkpoint terakhir. Instruksi awal agen: **Baca AGENTS.md dan CHECKPOINT.md, periksa file aktual, lalu lanjutkan langkah berikutnya tanpa mengulang fase yang sudah terverifikasi.** Jika ingin mempertahankan seluruh bukti studi/arsip dokumentasi, salin folder research juga. Source archive checkpoint sengaja mengecualikan rahasia, dependency, build dan cache.

Typecheck menghasilkan deklarasi route Next terlebih dahulu, sehingga tetap dapat dijalankan dari source archive tanpa folder .next. Source archive terbaru juga menyertakan laporan verifikasi yang sudah disanitasi.

## M1 — Hotspot lokal dan fixture

```bash
npm run ingest:hotspots -- --fixture
npm test -- tests/hotspot-ingest.test.ts tests/hotspot-storage-api.test.ts tests/hotspot-route-r2.test.ts
npm run verify -- M1
```

CLI fixture menghasilkan tiga **deteksi sintetis bertanggal tetap**, bukan kondisi terkini. Hasilnya hanya masuk `.data/hotspots-fixture`; API operasional tidak membacanya. `npm run dev` tetap menampilkan belum tersedia sampai sumber operasional terkonfigurasi. Pengujian route memanggil handler langsung, sehingga tidak memerlukan port localhost dan tidak dianggap uji browser/HTTP socket.

Untuk ingest nyata, isi key proyek di `.env.local` lalu jalankan `npm run ingest:hotspots`. Tanpa R2, mode development menyimpan ke `.data/hotspots`; gunakan R2 untuk produksi. Jangan menjalankan beberapa writer manual bersamaan. Lock `.writer-lock` melindungi writer lokal; setelah crash, pastikan tidak ada writer aktif sebelum menghapus direktori lock secara manual. Conditional writes menghindari penimpaan pointer oleh run lama; metadata run terputus tetap menyebabkan status stale sampai publikasi baru berhasil.

Route tersedia: `/api/hotspots?range=24h`, `48h` atau `7d`, dengan `source`, `confidence` dan `bbox=w,s,e,n` opsional sesuai 04. Source error → 503/null; snapshot partial/stale masih dalam batas umur → 200 dengan metadata; cache CDN hanya untuk status ok dan tidak melewati deadline. Peta interaktif masuk M2.

## M2 — Monitoring dan batas verifikasi

Halaman `/peta` sudah memuat pencarian tempat/koordinat, filter hotspot, MapLibre, daftar berhalaman, detail, status sumber dan panel lokasi. Tanpa key CARTO, WebGL menggunakan batas lokal; tanpa WebGL gunakan daftar dan pencarian. Isi `NEXT_PUBLIC_CARTO_API_KEY` hanya dengan key browser proyek yang dibatasi domain/paketnya. Tidak perlu key untuk menjalankan unit test/build atau membaca halaman.

`npm run verify -- M2` memeriksa unit test, typecheck, build, struktur HTML monitoring, API handler dan CLI fixture terisolasi. Pengujian interaksi browser, navigasi keyboard/screen reader, tile nyata dan benchmark perangkat belum dilakukan. PM2.5 serta rekomendasi pada panel belum terhubung; implementasi berikutnya adalah M3/M4.

## M3 — Udara per lokasi

```bash
npm run verify -- M3
npm run check:env
npm run dev
```

Pilih lokasi pada `/peta` untuk memakai `/api/air?lat=-2.21&lon=113.92`. Panel memisahkan PM2.5 jam kini, estimasi indeks 24 jam, riwayat model dan prakiraan maksimal 48 jam. Grafik/table tidak mengisi data hilang. Angka tidak akan tampil jika API unavailable; fixture/research tidak dipakai sebagai data operasional.

Development memakai cache disk `.data/air`, satu limiter bersama untuk perangkat development (20/menit) dan anggaran konservatif 100 HTTP attempt/hari. Akses fetch Open-Meteo dari runtime masih harus diuji pada mesin berjaringan; kegagalan DNS/network tetap ditampilkan unavailable/fallback. `.data` tidak dipindahkan melalui arsip checkpoint kode.

Produksi memerlukan R2 + `RATE_LIMIT_PROVIDER=persistent` + `RATE_LIMIT_SECRET` unik minimal 32 karakter + `AIR_UPSTREAM_REQUESTS_PER_DAY` dari anggaran nyata, serta Vercel dengan identitas IP tepercaya. Host/adapter limiter lain belum siap. Key Open-Meteo berbayar harus dipasangkan dengan `https://customer-air-quality-api.open-meteo.com`; endpoint publik tidak menerima key customer. Tidak ada aktivasi/pembelian/deploy lewat instruksi ini.

`npm run maintain:air` membersihkan cache/attempt/limiter disk lokal yang kedaluwarsa, dengan conditional delete. R2 membutuhkan konfigurasi lifecycle terpisah sesuai OPERATIONS.md; CLI tidak menganggap conditional delete R2 telah didukung.

`npm run replay:air` memproses ulang bukti respons publik historis pada waktu evaluasinya. Perintah opsional ini memerlukan folder research/2026-10-28-open-meteo yang sengaja tidak disertakan arsip source checkpoint. Full verify/unit test tidak bergantung pada research atau jaringan. Hasil replay tidak sama dengan konektivitas runtime aplikasi.
