# Operasi dan akses provider — M0

## Status nyata

NASA FIRMS, R2, CARTO dan rate limiter belum dikonfigurasi untuk proyek ini. Tidak ada akun cloud, workflow terjadwal atau deployment yang diaktifkan. `npm run check:env` hanya memverifikasi bentuk konfigurasi dan menampilkan status keberadaannya; bukan bukti konektivitas.

## Daftar konfigurasi sebelum integrasi/layanan publik

| Kebutuhan | Yang harus diverifikasi | Status |
| --- | --- | --- |
| NASA FIRMS | Key proyek sah, akses tiga source VIIRS, kuota dan smoke Area API | Pending key/smoke |
| R2 | Bucket/endpoint, izin prefix read/write, request nyata dan pemulihan pointer | Pending akun/key/smoke |
| CARTO | Key browser, pembatasan domain, paket penggunaan dan atribusi | Pending key/paket |
| Open-Meteo | Jenis penggunaan CP dan paket/endpoint yang sesuai; smoke publik dicatat terpisah | Klasifikasi/paket produksi pending |
| Rate limiter | Hosting/persistent adapter; 20 request/menit/IP gabungan route udara/tindakan | Pending konfigurasi dan uji |
| GitHub Actions | Repo/default branch, concurrency, secret writer, kuota runner dan jadwal | Pending; belum diaktifkan |
| Vercel | Paket, timeout runtime, environment dan hasil deploy | Pending; belum dipublikasikan |

## Worksheet biaya dan kuota

- Hotspot: target 48 run/hari. Contoh query jendela delapan tanggal berarti dua batch × tiga source = enam HTTP request/run, sebelum retry/bootstrap/manual. Transaksi NASA dapat berbeda dari jumlah HTTP request; gunakan metrik provider untuk anggaran nyata.
- Runner: `48 × durasi_job_detik / 60` menit per hari. Ukur durasi setelah M1, lalu cocokkan kuota/paket akun; jangan mengasumsikan semuanya gratis.
- Storage: ukur ukuran snapshot terkompresi × jumlah snapshot yang dipertahankan, cache udara, metadata dan log; retensi mengikuti policy.ts.
- Udara: hitung request upstream/cache miss per lokasi, bukan seluruh hit browser. Rate limiter per-IP tidak sama dengan batas kuota aplikasi harian.
- Basemap: catat request tile/style/glyph, jenis penggunaan dan paket provider yang benar-benar dipilih.

Isi angka pemakaian dan biaya dari akun proyek ketika akses tersedia. Tidak ada nilai biaya/kuota akun yang dibuat-buat dalam worksheet ini. Keputusan produksi dan hasil smoke dicatat di checkpoint baru, tanpa menulis nilai key.

## M1 — Writer dan pemulihan

Kode adapter NASA, disk/R2, snapshot, CLI dan GET `/api/hotspots` telah disiapkan untuk verifikasi lokal. Status integrasi live tetap mengikuti tabel di atas. Jangan mengisi key di source, checkpoint, URL log atau output job. CLI hanya mencetak status aman, ID snapshot, jumlah deteksi dan provenance batch tanpa URL/key.

- Urutan publikasi: latest-attempt running → payload immutable gzip → fallback pointer tervalidasi → current pointer conditional → metadata published. Gagal sebelum commit tidak merusak payload aktif; terputus setelah commit tetap stale sampai metadata/publikasi baru terverifikasi.
- `hotspots/last-good.json` adalah fallback pointer tambahan terhadap layout 02; metadata run berada di `jobs/hotspots/runs`. Validasi fallback tidak memperbarui fetchedAt/asOf. Jika fallback juga rusak/kedaluwarsa, API unavailable.
- Retensi memakai waktu modifikasi objek storage (14 hari snapshot, 30 hari log); kedua pointer dan run metadata terbaru selalu dikecualikan. Pointer invalid membatalkan pruning. Kegagalan pruning dicatat CLI sebagai retention failed dan exit nonzero; tidak membatalkan payload yang sudah dipublikasikan.
- Workflow masih manual dan digate `ENABLE_HOTSPOT_INGEST`; cron 7/37 UTC dinonaktifkan. Sebelum aktivasi, verifikasi akses tiga VIIRS, perhitungan kuota, R2 read/write/conditional write/delete/pagination, recovery serta durasi runner. Batasi writer ke satu group dan jangan jalankan writer eksternal serentak.
- Belum ada uji GitHub runner, izin R2 nyata, otomasi alarm atau integrasi browser. Hal ini merupakan gate operasi, bukan hasil unit test.

## M3 — Gate udara, pembatas dan retensi

Implementasi lokal tersedia: adapter CAMS global, seri gzip/checksum, lease/cooldown, `/api/air`, limiter persisten sliding 20/menit bersama air/tindakan, anggaran upstream harian, dan panel. Sebelum produksi verifikasi:

| Konfigurasi | Gate aktual |
| --- | --- |
| R2 read/write/CAS | Pending kredensial dan uji multi-instance nyata; unit/disk/mock sudah diuji |
| RATE_LIMIT_PROVIDER=persistent | Implementasi tersedia; status konfigurasi tidak membuktikan konektivitas |
| RATE_LIMIT_SECRET | Secret unik minimal 32 karakter; jangan pakai secret contoh/development di produksi |
| AIR_UPSTREAM_REQUESTS_PER_DAY | Isi sesuai kuota/paket/anggaran; produksi tidak memberi default |
| Identitas IP | Hanya Vercel runtime/header tepercaya saat ini; host lain memerlukan adapter. Validasi header di deployment nyata |
| Timeout hosting | Cocokkan maxDuration 75 detik dengan paket/runtime; fetch upstream dibatasi 20 detik dan dua attempt |
| Jenis penggunaan Open-Meteo | Endpoint publik/customer harus sesuai klasifikasi CP; belum diputuskan untuk produksi |
| Lifecycle R2 | Belum dikonfigurasi; target cleanup di tabel bawah |

Target lifecycle per prefix (gabungkan dengan rule bucket yang sudah ada, jangan mengganti rule hotspot tanpa review):

| Prefix | Target umur objek |
| --- | --- |
| air/cache/ | 1 hari / 24 jam |
| air/attempts/ | 1 hari / 24 jam |
| limits/air-actions/ | 1 hari / 24 jam |
| limits/upstream/ | 2 hari / 48 jam |

Lifecycle bekerja asinkron; verifikasi waktu penghapusan nyata sesuai dokumentasi R2. Batas penyajian fallback enam jam tetap tegas pada aplikasi. Tidak ada rule yang diterapkan pada akun oleh sesi implementasi ini. Perintah maintenance lokal mencatat jumlah objek yang dihapus saja, tanpa koordinat/IP mentah/key. HMAC IP merupakan identitas teknis untuk rate limiting, bukan profil pengguna.

Metrik provider yang tersedia pada storage: jumlah HTTP attempt harian (termasuk retry). Cache hit tidak menambah attempt. Run gagal menggunakan reason code aman; request URL bertoken tidak dicatat. UI menerima 429/Retry-After bila batas pengguna tercapai, dan source-shaped 503 bila sumber/limiter belum siap. Produksi fail-closed; menuliskan RATE_LIMIT_PROVIDER=hosting belum memasang limiter hosting.
