# 01 — Product Requirements Document

**Dokumen aktif v1.0 · 27 Oktober 2026 · Belum merupakan implementasi.**

## 1. Tujuan dan pengguna

Lentera Karhutla membantu masyarakat menjawab tiga pertanyaan: **di mana deteksi panas tercatat, bagaimana PM2.5 pada lokasi pilihan, dan tindakan apa yang relevan berdasarkan informasi yang tersedia?** Hotspot bukan kebakaran yang sudah dikonfirmasi. PM2.5 awal berasal dari model atmosfer, bukan pembacaan sensor di rumah pengguna.

Pengguna utama adalah masyarakat umum, kelompok sensitif terhadap polusi, dan orang yang beraktivitas di luar ruang. Mereka memerlukan tampilan yang mudah dipakai pada ponsel, sumber yang dapat diperiksa, serta perbedaan yang jelas antara data tersedia, lama, sebagian, dan tidak tersedia. Pemilihan kelompok dilakukan manual dan tidak disimpan sebagai profil kesehatan.

## 2. Scope MVP dan requirement

| ID | Requirement | Kriteria produk |
| --- | --- | --- |
| FR-01 | Peta hotspot Indonesia | Titik/cluster dapat diperiksa; sumber, satelit, confidence dan waktu akuisisi terlihat; jumlah berlabel deteksi |
| FR-02 | Filter hotspot 24h/48h/7d | Jendela bergerak UTC, filter confidence dan satelit, reset peta, serta pencarian lokasi/masukan koordinat |
| FR-03 | PM2.5 per lokasi | Nilai µg/m³, koordinat lokasi/grid, waktu berlaku dan label model tampil; seri prakiraan maksimal 48 jam sesuai cakupan provider |
| FR-04 | Estimasi indeks PM2.5 | US AQI PM2.5 berdasarkan rerata bergerak 24 jam model, metode/versi eksplisit; input kurang menghasilkan indeks tidak tersedia |
| FR-05 | Tindakan masyarakat | Panel rekomendasi untuk lokasi kini, kelompok general/sensitive/outdoor, alasan, sumber, waktu berlaku dan versi aturan |
| FR-06 | Kesegaran dan gangguan | Status `ok`, `stale`, `partial`, `unavailable` konsisten pada API/UI; kegagalan bukan nol atau status aman |
| FR-07 | Sumber dan metodologi | Sumber asli, atribusi, cakupan, keterbatasan, periode indeks dan kontak koreksi tersedia |
| FR-08 | Penggunaan mobile dan aksesibel | Peta dan informasi yang sama dapat diakses melalui kontrol keyboard, daftar deteksi, panel responsif dan label yang terbaca |

### A. Pemantauan hotspot — FR-01 dan FR-02

- Cakupan awal nasional menggunakan tiga sumber VIIRS NRT: S-NPP, NOAA-20, dan NOAA-21. MODIS termasuk fase lanjutan dengan normalisasi instrumen tersendiri.
- NASA FIRMS Area API dibaca oleh job terjadwal. Pengguna membaca snapshot melalui `/api/hotspots`, bukan memicu pengambilan seluruh data NASA pada setiap tampilan.
- Filter 24h/48h/7d memakai waktu akuisisi satelit, bukan waktu download. Query beberapa hari dipecah sesuai batas provider dan diakhiri filter timestamp yang tepat.
- Bbox adalah batas pengambilan, bukan batas negara. Ringkasan nasional menggunakan geometri indikatif Indonesia yang versinya tercatat; sumber batas dan keterbatasan generalisasinya dijelaskan.
- Lokasi dipilih melalui daftar tempat Indonesia dari gazetteer lokal, koordinat, atau klik peta. Daftar tempat tidak diklaim lengkap sampai desa. Pemilihan lokasi tidak otomatis meminta GPS.
- Jumlah deteksi pada area tampilan, periode, dan filter terpilih harus menyebut cakupannya. Tidak mengklaim jumlah kejadian kebakaran, luas terbakar, atau provinsi terburuk tanpa metodologi tambahan.

### B. PM2.5 dan indeks — FR-03 dan FR-04

- PM2.5 per lokasi adalah fitur MVP. Grid warna nasional dan animasi angin ditunda.
- Nilai per jam memakai Open-Meteo CAMS global. Lokasi grid hasil model dapat berbeda dari lokasi yang diminta; keduanya tersedia pada detail sumber.
- Angka utama adalah PM2.5 saat jam pilihan. Angka pendamping berlabel **“Estimasi US AQI PM2.5 — rerata model 24 jam”**. Ini bukan ISPU Indonesia, AQI resmi stasiun, indeks semua polutan, atau NowCast.
- Pilihan indeks mengikuti usulan pada 06 dan dikunci untuk MVP ini; perubahan ke ISPU memerlukan revisi metode, label, warna, rekomendasi dan pengujian secara bersamaan.
- Semua 24 sampel jam yang disyaratkan harus valid untuk menghitung rerata. Tidak mengganti sampel hilang dengan nol atau mengisi melalui interpolasi tanpa metode baru. Perhitungan rinci ditetapkan pada 04.
- Tampilan membedakan jam kini, riwayat model, dan prakiraan. Pengguna boleh menjelajahi prakiraan; panel tindakan MVP selalu menyatakan **untuk jam kini**, tidak mengikuti slider hotspot atau memberi kesan saran untuk masa lalu.

### C. Rekomendasi tindakan — FR-05

- Modul aturan deterministik mengolah data server yang tervalidasi, bukan teks yang dihasilkan bebas oleh AI atau angka yang dikirim pengguna.
- Tindakan memperhatikan kategori indeks dan pilihan kelompok. Panel menyebut alasan, waktu berlaku, pedoman asal dan versi aturan.
- Untuk data stale/partial/unavailable atau indeks yang belum dapat dihitung, tampilkan keterbatasan dan rujukan pedoman umum. Jangan memberikan rekomendasi personal berbasis kategori lama atau pesan otomatis “aman”.
- Informasi hotspot dan rekomendasi paparan udara tetap terpisah. Kedekatan hotspot tidak membuktikan sumber asap, kualitas udara di lokasi, atau perlunya evakuasi.
- Tautan otoritas lokal hanya ditampilkan jika sudah diverifikasi dan dicatat dalam katalog kontak. MVP tidak bergantung pada keberadaan kontak setiap daerah.

## 3. Ruang lingkup tahap berikutnya

| Kemampuan | Status |
| --- | --- |
| Hero singkat, peta, panel udara/tindakan, sumber data | Pendukung dan inti MVP sesuai FR-01–FR-08 |
| Grid warna PM2.5 dan animasi angin | Fase lanjutan; memakai pipeline grid terjadwal dan endpoint cuaca terpisah |
| MODIS, sensor lapangan, perbandingan instrumen | Fase lanjutan setelah normalisasi, cakupan dan sumber diverifikasi |
| Notifikasi, akun pengguna, laporan lapangan | Fase lanjutan dengan requirement tersendiri |
| Dukungan offline penuh, basemap tersimpan, PWA | Di luar MVP; last-good snapshot server tidak berarti perangkat dapat memuat ulang tanpa internet |
| Satwa, konsesi, permainan, 3D terrain, kampanye | Di luar scope CP saat ini |
| PostgreSQL/MongoDB/Redis, NestJS, PMTiles | Tidak dibutuhkan MVP; perubahan hanya jika kebutuhan baru membenarkannya |

## 4. Persyaratan nonfungsional

| ID | Persyaratan | Kriteria |
| --- | --- | --- |
| NFR-01 | Ketepatan semantik data | FR-01–FR-07 menampilkan sumber, unit, waktu, metode dan cakupan sesuai kontrak 04 |
| NFR-02 | Kesegaran | Job hotspot target tiap 30 menit; batas `ok` 90 menit sejak pengambilan valid; cache udara target 60 menit. Kebijakan stale/fallback lengkap pada 04 |
| NFR-03 | Performa | Median minimal **50 FPS desktop dan 40 FPS mobile** pada skenario benchmark 05; target pengujian, bukan hasil yang sudah terbukti |
| NFR-04 | Aksesibilitas | Target WCAG 2.2 AA untuk UI; keyboard, fokus, kontras, label tekstual kategori, dan daftar alternatif peta diuji manual |
| NFR-05 | Privasi | Tanpa pelacak pemasaran, tanpa GPS otomatis, tanpa akun/profil kesehatan; jelaskan request pihak ketiga dan cache teknis lokasi pada halaman privasi |
| NFR-06 | Keandalan | Snapshot persisten, pemisahan gagal vs nol sah, fallback berlabel umur, serta job idempotent dan terpantau |
| NFR-07 | Biaya dan kuota | Ukur job, storage, trafik tile/API dan jenis penggunaan. Tidak menjanjikan biaya Rp0 atau mengasumsikan free API cocok bagi penggunaan komersial |

Ukuran transfer dicatat terpisah untuk kode aplikasi, MapLibre, tile dan data. Tidak mengklaim payload atau FPS dari situs referensi sebagai hasil pengukuran CP.

## 5. Sumber dan tata kelola

Kode dan aset CP dibuat sendiri; jangan memakai endpoint Mandum Rimba sebagai upstream. NASA, Open-Meteo/CAMS, CARTO/OpenStreetMap dan Natural Earth mempunyai sumber/keterangan masing-masing. API key NASA dan storage hanya di server; key basemap yang memang dipakai browser harus dibatasi ke domain aplikasi sesuai kemampuan provider.

Lisensi distribusi kode asli diputuskan sebelum publikasi. Pemeriksaan konten rekomendasi, atribusi, key dan biaya merupakan pekerjaan milestone M0/M6, bukan pekerjaan yang dinyatakan telah selesai oleh dokumen ini.

Rujukan aktif: [arsitektur](02-ARCHITECTURE-DESIGN.md), [UI/UX](03-UI-UX-DESIGN-SYSTEM.md), [kontrak teknis](04-TECHNICAL-SPECIFICATION.md), [roadmap dan pengujian](05-IMPLEMENTATION-ROADMAP.md). Bukti teknis referensi tetap berada pada [06](06-MANDUM-RIMBA-ANALYSIS.md).
