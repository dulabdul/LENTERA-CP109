# 04 — Spesifikasi Teknis Kanonis

**Dokumen aktif v1.0 · 27 Oktober 2026 · Spesifikasi kanonis; status implementasi/hasil verifikasi pada CHECKPOINT.md.**

Dokumen ini menjadi sumber tunggal untuk nama endpoint, skema, konstanta, metode indeks dan aturan tindakan. [PRD](01-PRODUCT-REQUIREMENTS.md) menetapkan kebutuhan, [02](02-ARCHITECTURE-DESIGN.md) aliran sistem, [03](03-UI-UX-DESIGN-SYSTEM.md) presentasi, dan [05](05-IMPLEMENTATION-ROADMAP.md) verifikasi.

## 1. Keputusan dan konstanta

| Konstanta | Nilai MVP / makna |
| --- | --- |
| `SCHEMA_VERSION` | `1.0` |
| `HOTSPOT_SOURCES` | `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT` |
| `INDONESIA_FETCH_BBOX` | `[94.5, -11.2, 141.5, 6.5]`, urutan west/south/east/north; potong hasil dengan batas indikatif negara |
| `HOTSPOT_JOB_CRON` | `7,37 * * * *` UTC; jadwal target, bukan SLA |
| `HOTSPOT_WINDOW_HOURS` | `168`; request kalender mencakup semua tanggal yang beririsan |
| `FIRMS_MAX_DAYS_PER_QUERY` | `5`; verifikasi dukungan provider pada M0 dan revisi konstanta bila berubah |
| `HOTSPOT_FRESH_MINUTES` | `90` sejak pengambilan dataset valid |
| `HOTSPOT_MAX_FALLBACK_HOURS` | `24`; sesudahnya payload sumber tidak disajikan sebagai data operasional |
| `SNAPSHOT_RETENTION_DAYS` | `14`; simpan pointer aktif/fallback yang diperlukan sebelum pruning |
| `AIR_CACHE_MINUTES` | `60`; cache seri, bukan pembekuan hasil panel jam kini |
| `AIR_MAX_FALLBACK_HOURS` | `6` sejak fetch; lebih tua menjadi unavailable |
| `AIR_MAX_KNOWN_MODEL_AGE_HOURS` | `36`, hanya bila upstream menyediakan `runAt` |
| `AIR_CACHE_COORD_DECIMALS` | `2`; bucket teknis, bukan resolusi ilmiah |
| `AIR_FORECAST_HOURS` | `48` maksimum setelah jam kini yang tersedia |
| `INDEX_WINDOW_SAMPLES` | `24` jam berurutan, semuanya valid; tidak mengisi null |
| `INDEX_METHOD` | `rolling-24h-model` |
| `BREAKPOINT_VERSION` | `epa-pm25-2024` |
| `RULE_VERSION` | `lk-actions-1.0` |
| `JOB_LOG_RETENTION_DAYS` | `30`, tanpa token atau data profil pengguna |
| `AIR_CACHE_RETENTION_HOURS` | `24`; retensi storage bukan izin menayangkan fallback lebih dari 6 jam |
| `UPSTREAM_TIMEOUT_SECONDS` | `20` per request; maksimal 2 percobaan untuk kegagalan sementara, hormati Retry-After |

Ambang kesegaran, retensi, dan jadwal di atas adalah **kebijakan produk Lentera**, bukan jaminan satelit atau SLA provider. `fetchedAt` tidak membuktikan model baru diterbitkan atau seluruh api di lapangan terdeteksi.

Framework: Next.js App Router, React, TypeScript dan Node.js LTS yang kompatibel. M0 memilih rilis stabil yang masih mendapat dukungan dari [kebijakan Next.js](https://nextjs.org/support-policy), mencatat versi tepat dan menguncinya pada manifest/lockfile. Dokumen ini tidak memilih patch yang belum diverifikasi. Konfigurasi Tailwind mengikuti versi yang benar-benar dipasang. MapLibre dan font dicatat dengan cara yang sama; tidak menginstal paket tipe tambahan tanpa memeriksa tipe bawaan.

## 2. Struktur implementasi yang direncanakan

```text
src/app/                         # /, /peta, /sumber-data, /privasi
src/app/api/hotspots/route.ts     # snapshot dan filter
src/app/api/air/route.ts          # panel model lokasi
src/app/api/recommendations/route.ts
src/components/map/              # MapView, HotspotLayer, HotspotList, LocationSearch
src/components/air/              # AirPanel, AirChart, AqiBadge
src/components/actions/          # ActionPanel, AudienceSelector, SourceReason
src/components/data/             # DataStatus, SourceDetails, OfflineBanner
src/lib/contracts.ts             # tipe publik dan validasi schema
src/lib/policy.ts                # konstanta pada bagian 1
src/lib/providers/firms.ts       # CSV NASA; server/job saja
src/lib/providers/open-meteo.ts  # PM2.5; server saja
src/lib/storage/                 # R2 adapter, pointer dan cache
src/lib/services/                # layanan hotspot, udara, rekomendasi
src/lib/aqi.ts                   # fungsi murni indeks
src/lib/actions.ts               # aturan berversi
src/data/                       # geometri, gazetteer, contacts dan manifest sumber
scripts/ingest-hotspots.ts       # entrypoint CLI writer
scripts/import-geography.ts     # transformasi dataset dengan checksum/provenance
.github/workflows/ingest.yml     # manual trigger digate; cron target belum diaktifkan
```

Gunakan validasi runtime pada batas provider dan API; TypeScript saja tidak memvalidasi JSON. `src/lib/providers`, storage, kredensial dan layanan pengambil data tidak boleh terimpor ke bundle browser. Tipe/skema publik yang aman dipisahkan dari modul server.

## 3. Kontrak data

Cuplikan tipe berikut mendefinisikan bentuk minimum; implementasi validator harus memperkuat invariant yang dijelaskan sesudahnya.

```typescript
type IsoUtc = string; // ISO 8601 berakhiran Z; parser menolak tanggal invalid
type DataState = "ok" | "stale" | "partial" | "unavailable";
type Audience = "general" | "sensitive" | "outdoor";
type ViirsSource = "VIIRS_SNPP_NRT" | "VIIRS_NOAA20_NRT" | "VIIRS_NOAA21_NRT";
type AqiCategory = "good" | "moderate" | "sensitive" | "unhealthy" | "very_unhealthy" | "hazardous";

interface DataIssue {
  code: string; // enum validator: missing-source, upstream-error, missing-hour, dll.
  source: string | null;
  detail: string; // aman ditampilkan; tidak memuat URL bertoken
}
interface DataMeta {
  schemaVersion: "1.0";
  state: DataState;
  issues: DataIssue[];
  evaluatedAt: IsoUtc;
  fetchedAt: IsoUtc | null;
  lastAttemptAt: IsoUtc | null;
  validUntil: IsoUtc | null; // deadline status ok, bukan umur retensi berkas
  dataVersion: string | null;
}
interface SourceResponse<T> {
  meta: DataMeta;
  data: T | null; // unavailable => null; ok/partial/stale => payload tervalidasi
}
interface HotspotRecord {
  id: string;
  source: ViirsSource;
  satellite: "S-NPP" | "NOAA-20" | "NOAA-21";
  longitude: number;
  latitude: number;
  acquiredAt: IsoUtc;
  confidenceRaw: "l" | "n" | "h";
  confidence: "low" | "nominal" | "high";
  brightnessKelvin: number | null;
  frpMw: number | null;
}
interface HotspotCoverage {
  requestedFrom: IsoUtc;
  requestedTo: IsoUtc;
  asOf: IsoUtc; // waktu evaluasi snapshot; bukan jaminan kelengkapan pengamatan
  completedSources: ViirsSource[];
  missingSources: ViirsSource[];
  boundaryVersion: string;
  latestDetectionAt: IsoUtc | null;
}
interface HotspotPayload {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Omit<HotspotRecord, "longitude" | "latitude">;
  }>;
  coverage: HotspotCoverage;
  summary: { detectionsCount: number; areaLabel: string };
}
interface HourPm25 { validAt: IsoUtc; pm25UgM3: number | null }
type AqiEstimate =
  | { status: "unavailable"; reason: string }
  | {
      status: "available";
      method: "rolling-24h-model";
      breakpointVersion: "epa-pm25-2024";
      mean24hUgM3: number;
      truncatedUgM3: number;
      periodFrom: IsoUtc;
      periodTo: IsoUtc;
      sampleCount: 24;
      value: number | null; // null hanya pada beyondScale=true
      category: AqiCategory;
      beyondScale: boolean;
    };
interface AirPayload {
  requestedLocation: { lat: number; lon: number };
  queryLocation: { lat: number; lon: number }; // setelah bucketing cache
  modelGridLocation: { lat: number; lon: number };
  source: "open-meteo-cams-global";
  runAt: IsoUtc | null;
  current: HourPm25 | null;
  history: HourPm25[];
  forecast: HourPm25[];
  aqi: AqiEstimate;
}
interface ActionResult {
  mode: "targeted" | "limited";
  audience: Audience;
  location: { lat: number; lon: number };
  forTime: IsoUtc;
  ruleId: string;
  ruleVersion: "lk-actions-1.0";
  basisDataVersion: string | null;
  reason: string;
  messages: string[];
  sourceUrls: string[];
  createdAt: IsoUtc;
  validUntil: IsoUtc;
}
interface RecommendationResponse {
  meta: DataMeta; // status dataset dasar
  result: ActionResult; // mode limited tetap ada ketika meta.state unavailable
}
```

Invariant: angka harus finite, latitude/longitude sah, nilai PM2.5 nonnegatif atau null, dan timestamp mempunyai satuan/zonawaktu yang jelas. `SourceResponse` unavailable tidak membawa nilai lama tersembunyi sebagai current. Respons tindakan memakai `result` tersendiri agar alasan keterbatasan tetap dapat ditampilkan walaupun sumber unavailable.

Snapshot internal menambah `snapshotId`, checksum, `generatedAt`, cakupan per source/tanggal dan versi geometri. Cache udara menyimpan seluruh seri yang tervalidasi, koordinat query/grid, provider, `fetchedAt`, `runAt` jika ada, serta `dataVersion` hash konten dan provenance. Waktu akses cache tidak mengubah waktu fetch atau versi data.

## 4. Status dan kesegaran

Evaluasi server setiap request; browser mengecek deadline minimal setiap 60 detik, saat ganti jam dan kembali ke tab.

1. **unavailable:** tidak ada payload tervalidasi; seluruh pengambilan awal gagal; umur snapshot hotspot mencapai 24 jam; umur cache udara mencapai 6 jam; atau tidak ada sampel udara untuk jam yang sedang diminta. `data=null` pada API sumber.
2. **stale:** payload masih boleh ditampilkan tetapi umur fetch mencapai batas fresh, umur run model yang diketahui mencapai 36 jam, atau pengambilan terbaru gagal dan respons memakai fallback. Semua kekurangan tambahan tetap masuk `issues`.
3. **partial:** fetch belum stale tetapi ada source/tanggal yang gagal, baris yang ditolak secara material, jam wajib indeks yang hilang, atau cakupan prakiraan tidak lengkap. Nol pada payload partial tidak disebut nol nasional lengkap.
4. **ok:** payload tervalidasi, cakupan wajib terpenuhi, umur dalam kebijakan fresh dan tidak ada kegagalan yang menurunkannya.

Prioritas ketika beberapa kondisi berlaku: unavailable > stale > partial > ok. Tampilkan seluruh `issues`, bukan hanya label prioritas. Kegagalan satu sumber hotspot tidak mengubah status dataset udara; keduanya terpisah.

Perbandingan waktu memakai batas eksklusif untuk fresh: `now < validUntil`. Tepat pada `validUntil` status ok berakhir; tepat pada batas umur fallback menjadi unavailable. Payload non-null mewajibkan fetchedAt dan dataVersion non-null. Timestamp di masa depan yang tidak sesuai semantik forecast ditolak sebagai data invalid.

Batas fresh hotspot adalah `fetchedAt + 90 menit`; udara `fetchedAt + 60 menit`, dibatasi pula umur run bila diketahui. `runAt=null` ditampilkan sebagai “waktu run tidak diberikan provider”, bukan diisi dengan fetchedAt atau diklaim model baru. Rekomendasi juga berakhir pada pergantian jam; detail di bagian 8.

`latestDetectionAt` selalu terlihat pada detail. Umur deteksi saja bukan bukti bahwa job gagal: nihil deteksi baru dapat sah. Jika provider mengembalikan baris di luar tanggal yang diminta, anggap respons tidak valid; bila cakupan/availability provider tidak dapat dipastikan, tampilkan keterbatasannya dan jangan mengklaim kelengkapan lapangan. Header 200/cache HIT tidak menentukan status ini.

`validUntil` merupakan batas atas status ok jika tidak ada masalah baru. Browser dapat segera menurunkan status ketika offline/gagal refresh, tetapi tidak menaikkan stale menjadi ok tanpa evaluasi server baru.

## 5. Hotspot: rentang, normalisasi dan filter

Tetapkan `T` = waktu server evaluasi dan `N` = 24, 48 atau 168 jam. Interval hasil adalah **(T − N jam, T]**. Batas kiri eksklusif dan kanan inklusif harus sama pada API, UI dan fixture.

Job membangun jendela 168 jam menurut waktu run. Ambil tanggal UTC mulai tanggal batas kiri sampai tanggal T inklusif; batch maksimal lima tanggal per source. Contoh jendela 7d pada 27 Oktober 13:00 UTC memerlukan tanggal 20–27 Oktober, dapat dipecah 20–24 dan 25–27. Sesudah penggabungan, filter timestamp akhir menghapus bagian hari yang berada di luar interval.

API mengevaluasi T saat request dan menyaring snapshot. `coverage.asOf` tetap waktu snapshot, sehingga keterlambatan antara snapshot dan kini terlihat dan tidak disamarkan sebagai deteksi real-time. Kekurangan source/tanggal berbeda dari jeda polling normal yang masih berada dalam kebijakan fresh.

- ID deterministik dari source, satelit, timestamp UTC dan koordinat ternormalisasi. Hapus duplikat identik; jangan menggabungkan deteksi lintas satelit/waktu menjadi satu kebakaran.
- VIIRS `l/n/h` menjadi low/nominal/high; nilai asing ditolak atau ditandai issue, tidak otomatis nominal. Simpan kategori asli. MODIS tidak termasuk tipe/sumber MVP.
- Normalisasi HHMM menjadi timestamp UTC dan periksa tanggal; suhu kecerahan/FRP yang hilang tetap null, bukan nol.
- Potong dengan geometri indikatif Indonesia yang versi/checksumnya dicatat. Ringkasan bbox tampilan menghitung tepat fitur setelah filter area/waktu/source/confidence; bukan luas terbakar atau jumlah peristiwa.
- Seluruh request source gagal => pertahankan snapshot sebelumnya dan rekam usaha gagal. CSV error/kolom tidak sah bukan FeatureCollection kosong. Header valid dengan nol baris dan request berhasil dapat menjadi nol deteksi yang sah dengan cakupan jelas.

## 6. Kontrak endpoint publik

| Route GET | Parameter | Respons dan perilaku |
| --- | --- | --- |
| `/api/hotspots` | `range=24h\|48h\|7d`, `bbox=w,s,e,n` opsional, `source` dan `confidence` enum opsional | `SourceResponse<HotspotPayload>`; default 24h dan bbox nasional; hanya membaca snapshot |
| `/api/air` | `lat`, `lon` | `SourceResponse<AirPayload>`; lokasi Indonesia; panel jam kini dan seri yang benar-benar tersedia |
| `/api/recommendations` | `lat`, `lon`, `audience=general\|sensitive\|outdoor` | `RecommendationResponse`; mengambil data dasar dari layanan udara server yang sama; default general |

Koordinat wajib finite; bbox terurut dan dibatasi bbox layanan; lokasi udara di luar geometri layanan ditolak. Query invalid memberi 400 dengan kode aman. Rate limit memberi 429/Retry-After. Sumber unavailable memberi 503 dengan bentuk respons/status yang tetap dapat dibaca UI; partial/stale yang masih memiliki payload memberi 200 dengan meta yang benar. Tidak mengekspos pesan/token upstream.

API sumber dapat memakai CDN `s-maxage=60`, tanpa stale-while-revalidate tambahan; header max-age tidak melebihi sisa `validUntil`. Stale/partial/unavailable memakai no-store agar perubahan kualitas cepat terlihat. Route rekomendasi memakai no-store. Cache seri udara internal tetap mencegah setiap request rekomendasi memanggil upstream.

Pada M0 pilih rate limiter hosting yang membatasi gabungan route udara/tindakan maksimal 20 request/menit per IP dan catat konfigurasi serta biayanya; jika tidak tersedia, sediakan adapter limiter persisten yang diuji sebelum publikasi. Jangan mengklaim limiter dalam memori sebagai pembatas lintas instance. Ini gate implementasi, bukan fitur hosting yang dianggap otomatis tersedia. Batas anggaran provider dipantau melalui metrik request upstream, bukan hit frontend saja.

Tidak ada route mutasi publik untuk menulis snapshot. Writer berjalan sebagai CLI terjadwal. `/api/weather` disediakan hanya pada revisi fitur angin; tidak diiklankan sebagai endpoint MVP yang telah ada.

## 7. Metode estimasi indeks

1. Pilih H = awal jam UTC kini pada server. `current` adalah sampel H; label UI menyebut waktu berlaku H.
2. Ambil 24 sampel berurutan H−23 jam sampai H inklusif dari seri lokasi yang sama. Validasi semuanya finite dan nonnegatif. Sampel duplikat/absen tidak diperkirakan diam-diam; indeks unavailable bila syarat gagal.
3. Hitung mean aritmetika dalam µg/m³, lalu truncation satu desimal untuk breakpoint. Implementasi memakai aritmetika desimal/integer yang diuji pada batas agar floating point tidak memindahkan kategori secara keliru.
4. Untuk segmen konsentrasi [Clo, Chi] dan indeks [Ilo, Ihi], hitung `I = round((Ihi−Ilo)/(Chi−Clo) × (C−Clo) + Ilo)`.
5. Di atas 325,4 setelah truncation, `beyondScale=true`, `value=null`, kategori hazardous, UI “>500”. CP tidak melakukan extrapolasi numerik sendiri.

| PM2.5 rerata terpotong (µg/m³) | Indeks | Kategori |
| --- | --- | --- |
| 0,0–9,0 | 0–50 | good / Baik |
| 9,1–35,4 | 51–100 | moderate / Sedang |
| 35,5–55,4 | 101–150 | sensitive / Tidak sehat bagi kelompok sensitif |
| 55,5–125,4 | 151–200 | unhealthy / Tidak sehat |
| 125,5–225,4 | 201–300 | very_unhealthy / Sangat tidak sehat |
| 225,5–325,4 | 301–500 | hazardous / Berbahaya |

Rujukan angka: [tabel EPA](https://aqs.epa.gov/aqsweb/documents/codetables/aqi_breakpoints.html), [revisi 2024](https://www.epa.gov/system/files/documents/2024-02/pm-naaqs-air-quality-index-fact-sheet.pdf). Penggunaan rerata bergerak model dan persyaratan 24/24 sampel merupakan pilihan CP yang harus dijelaskan; bukan klaim laporan AQI resmi atau NowCast. Lihat [penjelasan EPA tentang perbedaan periode](https://www.epa.gov/wildfire-smoke-course/using-air-quality-index-aqi-plan-daily-activities).

Contoh fixture: semua 24 nilai 22,0 menghasilkan mean 22,0 dan indeks 75. Mean 9,09 dipotong menjadi 9,0; mean 9,1 memasuki kategori moderate. Tidak memakai angka PM2.5 sesaat sebagai pengganti mean.

## 8. Aturan tindakan berversi

Prasyarat mode targeted: `meta.state=ok`, sampel kini tersedia, indeks available, lokasi cocok dan dataVersion sama dengan basis. Mode targeted memakai `ruleId=LK-AIR-{category}-{audience}-v1`. Kelompok outdoor menerima tingkat kehati-hatian kelompok sensitif dengan label kegiatan luar ruang; ini pilihan konservatif CP yang dicatat pada rule.

Tabel pesan ringkas untuk adaptasi editorial; implementasi menyimpan teks kanonis di satu katalog, bukan mengulangnya pada komponen UI:

| Kategori | Umum | Kelompok sensitif / kegiatan luar ruang |
| --- | --- | --- |
| good | Pantau perubahan kondisi sebelum merencanakan aktivitas. | Pantau kondisi serta respons tubuh. |
| moderate | Pantau prakiraan dan perubahan kondisi. | Pertimbangkan kegiatan luar ruang yang lebih singkat dan ringan bila sensitif. |
| sensitive | Pantau kondisi dan kurangi paparan bila terganggu. | Kurangi durasi/intensitas kegiatan luar ruang dan tambah jeda. |
| unhealthy | Kurangi kegiatan luar ruang yang lama atau berat. | Hindari kegiatan lama/berat di luar; pertimbangkan memindahkan atau menjadwalkan ulang. |
| very_unhealthy | Hindari kegiatan luar ruang yang lama/berat. | Hindari aktivitas fisik di luar; pilih tempat dengan udara lebih bersih. |
| hazardous / beyondScale | Hindari aktivitas fisik di luar dan cari udara yang lebih bersih. | Tetap di ruang dengan udara lebih bersih dan kurangi aktivitas; ikuti arahan otoritas. |

Pedoman asal: [AirNow Particle Pollution Activity Guide](https://www.airnow.gov/sites/default/files/2023-03/air-quality-guide-for-particle-pollution_0.pdf). Teks adalah adaptasi bahasa Indonesia untuk informasi model dan perlu pemeriksaan konten sebelum rilis. Tidak membuat diagnosis, dosis obat, instruksi evakuasi otomatis, atau klaim keselamatan lokasi.

Bila prasyarat gagal, `mode=limited`, `ruleId=LK-DATA-LIMITED-v1`; jelaskan data yang kurang/lamanya, tampilkan pedoman umum dan jangan memberi pesan kategori terkini. Status rendah dari rerata 24 jam tidak boleh menjadi klaim tidak ada asap saat ini; panel tetap menunjukkan konsentrasi jam kini dan batas metode.

`validUntil` tindakan = minimum deadline fresh data dasar, deadline run model bila diketahui, dan H+1 jam. Mode limited mengevaluasi ulang paling lambat lima menit setelah `createdAt`. `basisDataVersion`, kategori, periode input, audience dan alasan dicatat pada respons; angka mentah dalam request pengguna tidak dipercaya.

Katalog kontak opsional berisi URL, wilayah/lokasi yang memang dilayani, sumber dan `verifiedAt`. Bila belum ada kontak yang sesuai, jangan membuat nomor/tautan. Informasi hotspot hanya memberi konteks deteksi dan rujukan terverifikasi; tidak menjadi input penentu kategori udara atau tindakan evakuasi.

## 9. Konfigurasi, data geografis dan operasi

Environment server: `FIRMS_MAP_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; `OPEN_METEO_BASE_URL` dan key customer opsional sesuai jenis penggunaan. Kredensial worker/write dipisahkan dari web/read kecuali prefix cache udara yang perlu ditulis server. Key server tidak memakai prefix `NEXT_PUBLIC_`.

Konfigurasi publik: key/URL basemap yang ditujukan provider bagi browser dan dibatasi domain. Gunakan CARTO Dark Matter/Positron dengan atribusi `© OpenStreetMap contributors, © CARTO`. Petunjuk key mengikuti [CARTO](https://www.carto.com/basemaps/apikey/index.html); URL lama tanpa key bukan asumsi integrasi. Tidak membuat akun atau membeli paket dalam pekerjaan dokumentasi.

Manifest geografi berisi release, source URL, checksum dan transformasi Natural Earth admin-0/populated places skala 1:10m. Pilih Indonesia, bangun GeoJSON/gazetteer lokal, verifikasi pulau/cakupan dan jelaskan generalisasi batas. Sumber bukan batas legal/daftar desa lengkap. Kontak lokal terpisah dari nama tempat.

Log/monitoring minimum: hasil tiap source/batch, jumlah baris valid/ditolak, requested coverage, latestDetectionAt, waktu fetch/run, versi snapshot/batas, retry, error code, cache hit dan umur data. Jangan log Authorization, upstream URL berkey, profil kelompok pengguna, atau riwayat pencarian individual.

Pada M0 verifikasi akun/paket provider, rate limiter, batas runner/storage, jenis penggunaan Open-Meteo dan baseline anggaran. Tidak ada jaminan gratis atau SLA 30 menit dari scheduler. Retensi dan batas freshness pada bagian 1 harus muncul sebagai konfigurasi yang dapat diperiksa dalam pengujian.

## 10. Verifikasi kontrak sebelum rilis

Roadmap [05](05-IMPLEMENTATION-ROADMAP.md) wajib menguji: batas rentang UTC, batch lima hari, deduplikasi lintas sensor, mask negara, null vs nol, respons 200 berisi data lama, source parsial, kegagalan/cold start, pergantian jam, expiry, 24 sampel indeks, semua batas breakpoint, beyondScale, audience, dan kecocokan dataVersion antara udara/tindakan.

Unit test, typecheck dan build M0–M3 telah tersedia, termasuk snapshot/handler/cache/limiter dengan fixture, disk lokal dan mock SDK serta struktur HTML monitoring; hasil aktual dicatat pada CHECKPOINT.md dan docs/verification. Bukti Open-Meteo yang diamati direplay terpisah dari konektivitas runtime. Integrasi produksi, M4, browser, perangkat dan seluruh acceptance criteria rilis tetap harus dijalankan pada milestone yang bersangkutan. Kelulusan unit test tidak membuktikan akses provider atau akurasi ilmiah model.
