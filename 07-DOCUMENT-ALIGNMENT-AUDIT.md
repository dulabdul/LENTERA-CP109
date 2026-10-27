# 07 — Penutupan Audit Penyelarasan Dokumen

**Revisi aktif v1.0 · 27 Oktober 2026 · Status: temuan dokumen ditutup pada tingkat spesifikasi.**

## 1. Ruang lingkup dan bukti perubahan

Audit awal menemukan ketidaksesuaian dokumen 01–05 dengan tujuan tiga fitur dan analisis 06. Setelah instruksi pengguna untuk memperbaiki seluruh dokumen, README dan 01–05 ditulis ulang secara konsisten; 06 mempertahankan bukti pengamatan dengan penandaan historis serta rujukan spesifikasi aktif.

Audit awal beserta delapan naskah sebelumnya disimpan pada [before-alignment.zip](research/2026-10-27-document-alignment/before-alignment.zip), dengan [checksum naskah](research/2026-10-27-document-alignment/before-manifest.json). Nomor baris yang disebut pada audit awal merujuk berkas dalam arsip tersebut, bukan nomor baris dokumen aktif.

Penutupan di sini berarti masalah **spesifikasi** sudah ditangani. Setelah audit dokumen, eksekusi M0 menyediakan fondasi lokal dan verifikasi unit/typecheck/build yang tercatat di [CHECKPOINT.md](CHECKPOINT.md). Integrasi akun/key, akurasi ilmiah model, kinerja perangkat, pengujian end-to-end dan deployment belum diverifikasi; penutupan temuan dokumentasi tidak menyatakan seluruh aplikasi selesai.

## 2. Penutupan sepuluh temuan

| ID | Temuan awal | Perbaikan pada dokumen aktif | Status dokumen |
| --- | --- | --- | --- |
| F01 | Rekomendasi masyarakat belum masuk rantai dokumen | PRD FR-05; modul server dan route rekomendasi pada 02/04; ActionPanel pada 03; M4 dan uji audience/expiry pada 05 | Tertutup |
| F02 | Tidak ada kontrak kesegaran/gagal/partial | NFR-02/FR-06; DataMeta dan prioritas state pada 04; state UI dan expiry pada 03; T05–T10/T13/T20 pada 05 | Tertutup |
| F03 | Angin diminta dari air-quality | MVP hanya PM2.5 lokasi; endpoint cuaca terpisah dijelaskan pada fase lanjutan 02/04/05 | Tertutup |
| F04 | FIRMS country dan rentang 7d belum tepat | Area API, tiga source VIIRS, batch maksimal lima tanggal, interval UTC dan mask negara pada 02/04; T01–T04 pada 05 | Tertutup |
| F05 | Indeks dan warna belum didefinisikan | Keputusan estimasi US AQI PM2.5 24 jam pada PRD; formula/breakpoint/beyondScale pada 04; kategori dan label pada 03; T10–T12 pada 05 | Tertutup |
| F06 | Fallback tanpa penyimpanan persisten | Job/snapshot/pointer/R2/retensi pada 02/04; perangkat offline dipisahkan dari upstream gagal; M1/T07/T17 pada 05 | Tertutup |
| F07 | Grid/partikel wajib tetapi kontraknya tidak memadai | Scope MVP per lokasi; grid/angin menjadi tahap berikutnya dengan kebutuhan pipeline tersendiri | Tertutup |
| F08 | Label melebihi bukti: persentase confidence, sensor langsung, peringkat nasional | Data model dan confidence kategori, sumber/waktu/grid, hitungan sesuai cakupan serta tanpa klaim aman pada PRD/03/04 | Tertutup |
| F09 | Roadmap tidak menjamin tiga fitur dan target FPS berbeda | M0–M6 menelusuri FR-01–FR-08; 20 skenario uji; satu protokol 50 FPS desktop/40 FPS mobile pada 05 | Tertutup |
| F10 | Klaim teknologi/performa/biaya/lisensi dan setup tidak tepat | Referensi MongoDB diberi konteks; biaya bersyarat; versi dikunci pada M0; key/paket basemap dan scheduler diperiksa; klaim hasil REA/benchmark CP yang belum ada dihapus | Tertutup |

## 3. Keputusan lintas dokumen yang sudah ditetapkan

| Bidang | Keputusan aktif | Lokasi kanonis |
| --- | --- | --- |
| Tujuan | Hotspot, PM2.5/kualitas udara, tindakan masyarakat | PRD FR-01–FR-08 |
| Cakupan | Hotspot nasional dalam batas indikatif; udara per lokasi; pencarian lokal/koordinat/peta | PRD dan 02 |
| Sensor MVP | VIIRS S-NPP, NOAA-20 dan NOAA-21; MODIS kemudian | 04 bagian 1/5 |
| Indeks | Estimasi US AQI PM2.5 dari 24 sampel model; bukan ISPU/NowCast | 04 bagian 7 |
| API publik | `/api/hotspots`, `/api/air`, `/api/recommendations` | 04 bagian 6 |
| Data lama/gagal | Empat state, ambang fresh/fallback, status sumber terpisah | 04 bagian 1/4 |
| Rekomendasi | Server-side, general/sensitive/outdoor, targeted/limited, alasan dan expiry | 04 bagian 8 |
| Infrastruktur awal | Vercel Node.js, R2, GitHub Actions writer terjadwal | 02 |
| Geografi/basemap | Natural Earth indikatif; CARTO berkey dan atribusi | 02 dan 04 |
| Performa | Median 50 FPS desktop/40 FPS mobile pada protokol yang sama | 05 bagian 4 |
| Fase berikutnya | Grid PM2.5, angin, MODIS, sensor lapangan, notifikasi | PRD dan 05 bagian 6 |

## 4. Verifikasi dokumentasi

Pemeriksaan penutupan meliputi:

- Konsistensi ID requirement, endpoint, state, metode indeks, scope MVP dan target performa lintas dokumen.
- Validitas tautan lokal aktif dan keberadaan arsip naskah sebelum revisi.
- Konsistensi contoh perhitungan indeks dan label ilustratif; tidak menjalankan pengujian kesehatan atau akurasi model.
- Keseimbangan code fence/struktur tabel dan keterbacaan diagram/alur dokumentasi.
- Pemisahan bukti historis pada 06 dari keputusan dan status implementasi kini.

Ringkasan pemeriksaan mekanis disimpan pada [verification.json](research/2026-10-27-document-alignment/verification.json) setelah validasi. Hasil itu adalah pemeriksaan dokumen, bukan laporan build atau tes aplikasi.

## 5. Pekerjaan yang tetap berada pada implementasi

Versi paket tepat, key/akun, manifest dataset hasil unduh, konfigurasi rate limiter, klasifikasi penggunaan/paket provider dan baseline anggaran diselesaikan pada M0. Ini gate eksekusi yang eksplisit; dokumen tidak menganggap integrasi berfungsi tanpa akses tersebut.

M1–M6 membangun dan menguji aplikasi. Konten rekomendasi harus diperiksa sebelum publikasi; identitas reviewer dan hasilnya dicatat saat pelaksanaan. Pengukuran FPS memakai perangkat fisik/ekuivalen tercatat. Workflow, storage cloud dan deployment hanya diaktifkan dalam lingkup pekerjaan implementasi yang diinstruksikan pengguna.

Jika scope atau metode berubah, perbarui PRD terlebih dahulu, turunkan ke arsitektur/kontrak/UI/roadmap, lalu catat perubahan pada audit ini. Jangan membiarkan pembaca memilih sendiri di antara dua kontrak yang bertentangan.
