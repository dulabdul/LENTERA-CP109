# Keputusan implementasi

## D001 — Jalur lokal dan checkpoint

Tanggal: 27 Oktober 2026. Implementasi berada pada repo lokal ini, mengikuti Next.js/MapLibre dan roadmap M0–M6. Pengguna mengharuskan checkpoint tiap fase untuk pergantian AI agent. `AGENTS.md`, `CHECKPOINT.md`, dan `docs/checkpoints/` merupakan jalur handoff yang tidak memerlukan riwayat percakapan.

Panduan Sites dibaca untuk routing workflow; jalur local-only digunakan sesuai arsitektur dan sasaran aplikasi lokal yang telah disepakati. Tidak ada identitas Sites atau deployment yang dibuat.

## D002 — Versi dependency

Status: versi telah dipin dan terpasang pada Node.js 22.22.0/npm 10.9.4. Next.js 16.4.3, React/React DOM 19.3.1, TypeScript 5.9.3, MapLibre 6.16.0, Zod 4.6.7, Tailwind 4.3.3 dan Vitest 5.0.5. TypeScript 5.9 dipilih untuk fondasi yang kompatibel dengan Next 16; tipe Node 22 mengikuti runtime, bukan tipe Node major terbaru. Metadata resmi registry dan kebijakan support Next diperiksa sebelum pemasangan. Nilai tepat beserta transitive integrity ada pada package.json/package-lock.json.

## D003 — Status provider

Status: akses NASA FIRMS, R2 dan CARTO belum diverifikasi. Fixture digunakan hanya untuk verifikasi deterministik dan harus dilabeli sintetis. Smoke respons publik Open-Meteo berhasil: 120 jam PM2.5 bertimestamp seragam dengan unit benar; laporan di docs/verification/open-meteo-smoke.json. Ini bukan integrasi route aplikasi atau validasi ilmiah model. Geografi diimpor tanpa kredensial. Tidak ada pembelian/aktivasi cloud otomatis.


## D004 — Build tanpa jaringan dan batas preview

Build memakai Webpack agar jalur M0 dapat diverifikasi pada sandbox; Next.js tetap memakai App Router. Font lokal bawaan sistem dipakai pada shell M0; self-host Fraunces/Plus Jakarta Sans/JetBrains Mono menjadi pekerjaan UX M5, bukan unduhan jaringan saat build. Shell M0 belum merupakan peta interaktif atau integrasi operasional.

CLI tsx mencoba membuat socket IPC dan ditolak sandbox. Script TypeScript dijalankan melalui `node --import tsx` tanpa server IPC. Preview `next start` pada 127.0.0.1:3100 ditolak EPERM; ini batas lingkungan, bukan hasil uji browser/FPS.

## D005 — Instalasi dependency pada jaringan terbatas

npm online gagal ENOTFOUND. Metadata/tarball resmi registry diunduh dengan curl; 146 tarball diverifikasi terhadap integrity registry, lalu cache npm diisi dan pemasangan offline berhasil (145 paket untuk platform ini). Lifecycle script dilewati pada instalasi awal; unit test, typecheck dan build dipakai untuk memeriksa toolchain yang terpasang. Cache berada pada /tmp, bukan bagian source archive. Mesin lain dapat memakai npm ci dengan jaringan normal. Tidak ada sandbox atau kebijakan izin yang dinonaktifkan.

## D006 — Geografi dan fixture

Natural Earth countries 5.1.1 dan populated places 5.1.2 diimpor dari archive resmi. Geometri Indonesia dipertahankan; 105 tempat tersedia untuk pencarian lokal. Versi, URL, checksum input/output dan transformasi tersimpan di src/data/geography-manifest.json. Ilustrasi batas pada beranda disederhanakan hanya untuk preview SVG, tidak untuk mask layanan. Fixture kualitas udara/CSV di fixtures/ bersifat sintetis dan tidak ditampilkan sebagai data kini.

## D007 — Pipeline M1 dan publikasi snapshot

Tanggal: 28 Oktober 2026 WIB. Adapter NASA mematuhi [Area API resmi](https://firms.modaps.eosdis.nasa.gov/api/area/) (tanggal awal inklusif, 1–5 hari) dan [contoh atribut resmi](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html). Semua invalid row yang material menjadi issue; respons yang seluruh barisnya invalid atau berisi tanggal di luar request menjadi batch gagal. Identitas memakai SHA-256 dari source/satelit/UTC/koordinat numerik; tidak membulatkan koordinat ke resolusi buatan. Satu source hanya complete bila seluruh batch dan barisnya valid. Semua batch gagal mempertahankan pointer sebelumnya. `coverage.latestDetectionAt` mencerminkan keseluruhan snapshot, termasuk saat respons API difilter; `summary.detectionsCount` selalu jumlah fitur hasil filter.

Snapshot gzip immutable diberi ID hash JSON, checksum gzip, fetchedAt, payload, issue, provenance per batch dan flag synthetic. Pointer `current.json` dipublikasikan sesudah payload selesai; `last-good.json` menyimpan pointer sebelumnya yang telah tervalidasi (dapat partial), bukan jaminan pengamatan lengkap. Conditional write/ETag melindungi pointer dari writer lama. Metadata usaha dimulai sebelum pengambilan, sehingga run gagal/terputus menyebabkan fallback stale tanpa mengganti payload. Pemulihan memvalidasi pointer, checksum, identitas dan schema; batas umur tetap dihitung dari fetch asli. Pruning menjaga kedua pointer dan log run terakhir.

Adapter disk hanya untuk development/fixture; R2 wajib untuk storage produksi. CLI memakai `--conditions=react-server` agar boundary `server-only` tetap diberlakukan Next tanpa membuat server IPC. Fixture terisolasi di `.data/hotspots-fixture`, dilabeli synthetic pada payload dan tidak pernah dibaca API operasional. API hanya membaca storage, tidak memanggil NASA. `.data` bukan bagian source archive; backup operasional disediakan melalui storage, terpisah dari checkpoint kode.

## D008 — Workflow disiapkan, operasi belum diaktifkan

`.github/workflows/ingest.yml` menyediakan manual trigger, satu concurrency group dan timeout; cron target 7/37 UTC masih komentar. Job juga memerlukan variable `ENABLE_HOTSPOT_INGEST=true`. Tidak ada push, aktivasi variable/secret atau run cloud pada sesi ini. Commit action v6 dipin dari GitHub refs resmi actions/checkout dan actions/setup-node saat implementasi. Aktivasi jadwal menunggu gate NASA/R2/anggaran/runner dan lingkup operasi yang sesuai; bukan persetujuan ulang untuk pekerjaan kode rutin. R2 conditional write dan GitHub runner belum diuji live.

## D009 — M2: peta sebagai satu jalur, daftar tetap tersedia

Tanggal: 28 Oktober 2026 WIB. MapLibre dimuat dinamis hanya pada halaman monitoring; UI memakai raster CARTO Dark Matter `rastertiles/dark_all/{z}/{x}/{y}.png?key=...` sesuai [contoh dan varian resmi CARTO](https://www.carto.com/basemaps/). Tanpa key tidak ada request basemap; batas indikatif lokal ditampilkan jika WebGL tersedia. Atribusi juga berada di luar canvas. Gangguan basemap/WebGL tidak menghapus daftar, pencarian atau panel. Tidak mengklaim browser/layanan tile berhasil hanya karena kompilasi lulus.

Pencarian nama memakai 105 tempat Natural Earth dan masukan koordinat tervalidasi terhadap geometri lokal. Lokasi tidak memakai GPS otomatis. Klik hotspot membuka detail; perpindahan lokasi panel udara memerlukan tombol eksplisit. M2 menggunakan panel inline yang dapat disembunyikan pada mobile, bukan modal drawer/tab; ini mempertahankan informasi dalam urutan dokumen tanpa focus trap. Target drawer/tab dapat ditinjau pada M5 setelah uji perangkat; label dan kontrol minimum tetap mengikuti 03.

API mengambil snapshot tersaring periode/source/confidence; viewport/filter waktu lokal menghasilkan daftar dan ringkasan dari himpunan fitur yang sama. Polling/evaluasi expiry setiap 60 detik, tab aktif dan koneksi kembali; request filter lama dibatalkan agar respons lokasi/filter lama tidak menimpa state baru. Offline/gagal refresh hanya dapat menurunkan status; fallback 24 jam tidak lagi ditayangkan. Riwayat hotspot tidak mengendalikan panel tindakan kini. Bundle geometri lokal dan MapLibre cukup besar: ukuran artifact dicatat terpisah di docs/verification/M2-build-assets.json; gzip lokal bukan pengukuran transfer browser atau FPS.

Review penutupan M1/M2: metadata setiap usaha pengambilan juga menyimpan provenance batch dan issue yang aman, termasuk saat semua request gagal sehingga tidak ada snapshot baru. Respons fallback menyertakan issue usaha gagal, bukan hanya label stale. Ini menjaga alasan kegagalan tetap dapat ditelusuri tanpa mencatat URL bertoken. Layout metadata ini belum digunakan pada layanan produksi; fixture lama dapat dibuat ulang dengan CLI.

## D010 — M3: seri model, indeks, dan proyeksi jam

Tanggal: 28 Oktober 2026 WIB. Adapter memakai [Air Quality API resmi Open-Meteo](https://open-meteo.com/en/docs/air-quality-api): `hourly=pm2_5`, `domains=cams_global`, `past_days=2`, `forecast_days=3`, `timezone=GMT`, `timeformat=unixtime`. Host dibatasi ke endpoint publik atau customer resmi; key hanya dikirim ke endpoint customer. Self-host/proxy lain memerlukan keputusan tersendiri. Validasi memeriksa unit µg/m³, offset nol, urutan/jam unik, ukuran/format dan tanggal respons. Grid yang lebih dari satu derajat dari query ditolak sebagai indikasi salah respons; ini pemeriksaan defensif, bukan klaim resolusi model. Nilai negatif menjadi null dengan issue, bukan nol. Run model tetap null karena endpoint yang dipakai tidak mendokumentasikan timestamp run; generationtime_ms bukan run/fetch time.

Cache menyimpan seluruh seri dan provenance per bucket 0,01°, terpisah dari lokasi request tepat. DataVersion adalah hash konten/provenance yang dinormalisasi, sedangkan checksum record juga melindungi fetchedAt. Setiap request mengambil H dari jam server dan menghitung current H, riwayat H−23…H−1, indeks 24/24 serta prakiraan tersedia hingga H+48. Cache hit tidak mengubah fetch/version. UI memperbarui proyeksi dengan waktu berlalu sejak evaluatedAt server agar tidak mengasumsikan jam perangkat benar; offline/gagal refresh tidak boleh menaikkan status. Grafik memutus garis pada jam/null yang hilang dan mempunyai tabel alternatif. Filter hotspot tidak menjadi input panel udara.

Lease storage 70 detik dan conditional writes menghindari stampede antar-instance; request dalam satu instance juga dikoalesensikan. Usaha gagal/terputus tetap terlihat stale bila last-good layak. Cooldown gagal minimal 60 detik atau Retry-After yang lebih panjang, dengan maksimal dua HTTP attempt dan timeout 20 detik per attempt. Umur tayang tetap <6 jam, terpisah dari target retensi storage 24 jam. Route memberi waktu runtime maksimum 75 detik, yang masih harus dicocokkan paket hosting sebelum produksi.

## D011 — M3: pembatas bersama dan anggaran upstream

Limiter persisten memakai sliding window 20 request per 60 detik dan conditional writes pada namespace yang sama untuk air/recommendations. Identitas disimpan sebagai HMAC SHA-256 memakai secret khusus, bukan IP mentah. Identitas produksi hanya dibaca dari `x-vercel-forwarded-for` pada runtime `VERCEL=1`, mengikuti [dokumen header Vercel](https://vercel.com/docs/headers/request-headers). Host lain belum mempunyai adapter tepercaya. Mode development memakai satu bucket bersama yang lebih konservatif dan tidak percaya forwarded header dari browser.

Produksi fail-closed jika R2, `RATE_LIMIT_PROVIDER=persistent`, secret minimal 32 karakter, anggaran harian atau identitas platform belum tersedia. Nilai `hosting` saja belum merupakan implementasi limiter. Anggaran harian global mencatat setiap HTTP attempt upstream termasuk retry dan tidak berkurang pada cache hit. Development dibatasi 100 attempt/hari untuk pengujian; produksi tidak mempunyai angka default dan harus diisi dari worksheet operasi. Uji dua instance/concurrency dilakukan lokal, bukan bukti akses R2 nyata.

`/api/air` memakai no-store agar setiap hit melewati limiter aplikasi dan panel tidak tertahan di jam/koordinat lama oleh CDN. Ini masih sesuai opsi cache 04: cache seri internal tetap aktif; CDN bukan keharusan. Runtime/pengujian rekomendasi M4 harus memakai service dan limiter yang sama.

## D012 — M3: retensi dan bukti integrasi

Adapter disk mendukung conditional delete agar maintenance tidak menghapus objek yang baru ditulis saat pruning. Dukungan conditional DeleteObject R2 tidak diasumsikan dari dukungan conditional PutObject; fungsi tersebut ditolak aman sebelum request. Produksi harus mengonfigurasi dan memverifikasi [object lifecycles R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) untuk prefix cache/attempt/limiter. Target cleanup cache/attempt/IP digest adalah 24 jam dan budget harian 48 jam; lifecycle provider bekerja asinkron dan dapat terlambat. Batas penyajian 6 jam tetap dipaksakan oleh aplikasi terlepas dari kapan objek dihapus. Maintenance CLI hanya menjalankan pruning mutable yang teruji pada disk lokal. Ini gate produksi yang belum diaktifkan, bukan retensi cloud yang telah dijalankan.

Respons publik untuk lokasi contoh tetap diambil melalui curl lalu diuji melalui parser, temporary disk cache dan AirService. Bukti historis tersimpan di research/2026-10-28-open-meteo, dapat direplay tanpa jaringan memakai `npm run replay:air`; hasil di docs/verification/M3-open-meteo-replay.json. Ini membuktikan kompatibilitas respons yang diamati dengan parser/proyeksi/cache, bukan konektivitas fetch runtime aplikasi, pengukuran sensor, validasi ilmiah atau pengujian browser. Tidak dimasukkan ke cache operasional/antarmuka sebagai data kini.

## D013 — M4: Aturan rekomendasi berversi, audience selector, dan sinkronisasi panel

Tanggal: 28 Oktober 2026 WIB. Mesin rekomendasi diimplementasikan server-side (`server-only`) pada `src/lib/actions.ts` dan dilayani melalui `GET /api/recommendations`. Aturan diisolasi dari input manipulatif pengguna; API tidak menerima nilai AQI atau kategori dari browser dan hanya membaca data dari `AirService` lokal yang sama. Aturan berversi `LK-AIR-{category}-{audience}-v1` mencakup 6 kategori AQI EPA 2024 dan 3 audiens: `general`, `sensitive`, serta `outdoor` (mengadopsi tingkat kehati-hatian kelompok sensitif untuk aktivitas fisik luar ruang).

Teks panduan mengadaptasi [AirNow Particle Pollution Activity Guide](https://www.airnow.gov/sites/default/files/2023-03/air-quality-guide-for-particle-pollution_0.pdf). Tidak ada diagnosis klinis, dosis medis, klaim keselamatan lokasi, atau instruksi evakuasi otomatis. Rekomendasi terarah (`targeted`) mensyaratkan `meta.state=ok`, masa berlaku belum lewat, sampel model 24/24 lengkap untuk jam kini, dan kecocokan basis dataVersion. Bila salah satu syarat gagal, sistem beralih ke mode `limited` (`LK-DATA-LIMITED-v1`) yang menjelaskan keterbatasan data tanpa menampilkan kategori lama.

Panel tindakan (`ActionPanel`) dan pemilih audiens (`AudienceSelector`) disinkronkan dengan panel udara (`AirPanel`) di bawah `LocationPanels`. Hook `useAirData` dan fetcher `fetchLocationData` membatalkan request usang melalui `AbortController` ketika lokasi atau audiens berganti. Perbedaan basis `dataVersion` antara respons udara dan rekomendasi memicu satu kali auto-retry sinkronisasi udara. Timer deadline dan clock monotonik (`performance.now()`) memastikan rekomendasi otomatis kedaluwarsa tanpa mengandalkan jam sistem perangkat pengguna. Rate limiter menggunakan bucket 20 request/menit bersama dengan route udara. Uji interaksi browser nyata dan performa tetap menjadi gate pending pada milestone berikutnya.

