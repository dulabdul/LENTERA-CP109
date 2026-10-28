import type { Metadata } from "next";
import Link from "next/link";
import { geographyManifest } from "@/lib/geography";
import { ACTION_SOURCE } from "@/lib/actions";

export const metadata: Metadata = {
  title: "Metodologi & Sumber Data Terbuka",
  description:
    "Penjelasan lengkap transparansi sumber data satelit NASA FIRMS VIIRS, model atmosferik PM2.5 CAMS ECMWF, breakpoint EPA 2024, batas indikatif Natural Earth, dan prosedur koreksi publik.",
  alternates: {
    canonical: "/sumber-data",
  },
  openGraph: {
    title: "Metodologi & Sumber Data Terbuka | LENTERA",
    description:
      "Transparansi sumber data satelit NASA FIRMS, model kualitas udara CAMS, formula US EPA 2024, dan tata kelola keterbukaan data LENTERA.",
    url: "/sumber-data",
  },
};

export default function SourcesPage() {
  return (
    <main id="main" className="page-section prose sources-page">
      <p className="eyebrow">SUMBER & METODE</p>
      <h1 className="page-title">
        Setiap angka<br />
        <em>memerlukan konteks.</em>
      </h1>
      <p className="lead-paragraph">
        Lentera Karhutla berpegang pada prinsip transparansi: menyajikan data lingkungan publik tanpa mengaburkan sumber, waktu pengambilan, atau keterbatasan metode. Data ditampilkan sesuai ketersediaan nyata dari penyedia yang disebutkan, termasuk data batas komunitas beratribusi; tidak ada data sintetis yang diklaim sebagai kondisi lapangan.
      </p>

      <nav className="source-index" aria-label="Daftar metode dan sumber">
        <a href="#hotspot-methodology"><span>01</span> NASA FIRMS ↘</a>
        <a href="#air-methodology"><span>02</span> Open-Meteo / CAMS ↘</a>
        <a href="#recommendations-methodology"><span>03</span> Pedoman AirNow ↘</a>
        <a href="#geography-methodology"><span>04</span> Geografi & peta ↘</a>
        <a href="#state-methodology"><span>05</span> Status data ↘</a>
        <a href="#correction-channel"><span>06</span> Jalur koreksi ↘</a>
      </nav>

      <section id="hotspot-methodology">
        <h2>1. Deteksi panas satelit (Hotspot)</h2>
        <p>
          Data deteksi termal diambil melalui <strong>NASA FIRMS (Fire Information for Resource Management System) Area API</strong> untuk wilayah kepulauan Indonesia.
        </p>
        <ul>
          <li><strong>Instrumen:</strong> Tiga sensor VIIRS (Visible Infrared Imaging Radiometer Suite) pada satelit <strong>Suomi NPP</strong>, <strong>NOAA-20</strong>, dan <strong>NOAA-21</strong>. Resolusi piksel nominal 375 meter pada nadir.</li>
          <li><strong>Periode tampilan:</strong> Jendela bergerak 24 jam, 48 jam, dan 7 hari dihitung berdasarkan <em>waktu akuisisi satelit (UTC)</em>, bukan waktu unduh.</li>
          <li><strong>Tingkat keyakinan:</strong> Kategori asli instrumen yaitu <code>rendah</code> (low), <code>nominal</code>, dan <code>tinggi</code> (high). Lentera tidak memalsukan nilai persentase buatan yang tidak disediakan satelit.</li>
          <li><strong>Metrik termal:</strong> Suhu kecerahan kanal satelit (Kelvin) dan Daya Radiasi Api / FRP (Megawatt) jika tersedia. Nilai yang tidak tercatat tetap berlabel tidak tersedia dan tidak diubah menjadi nol.</li>
          <li><strong>Batas metodologi:</strong> Titik panas adalah anomali suhu permukaan yang terdeteksi satelit. Titik panas <em>tidak otomatis berarti kebakaran hutan terkonfirmasi</em> di lapangan, dan ketiadaan titik panas tidak membuktikan ketiadaan api (misalnya akibat tutupan awan tebal atau jeda orbit satelit).</li>
        </ul>
        <p><strong>Mode Hexagon H3:</strong> Menjumlahkan deteksi yang lolos filter pada viewport dan periode yang sama dengan daftar. Resolusi 4/5/6 mengubah ukuran sel; sel dapat melintasi provinsi dan bukan batas administrasi. Warna cyan–ungu menyatakan jumlah deteksi, bukan AQI, luas terbakar atau jumlah kejadian kebakaran. Mode titik tetap tersedia untuk pemeriksaan individual.</p>
        <p>
          Rujukan resmi: <a href="https://firms.modaps.eosdis.nasa.gov/api/area/" target="_blank" rel="noopener noreferrer">Dokumentasi NASA FIRMS Area API ↗</a>
        </p>
      </section>

      <section id="air-methodology">
        <h2>2. Konsentrasi PM2.5 dan estimasi indeks udara</h2>
        <p>
          Data kualitas udara menggunakan model atmosfer global <strong>Copernicus Atmosphere Monitoring Service (CAMS)</strong> yang diakses melalui <strong>Open-Meteo Air Quality API</strong>.
        </p>
        <ul>
          <li><strong>Konsentrasi jam kini:</strong> Nilai konsentrasi massa partikulat PM2.5 dalam mikrogram per meter kubik (µg/m³) untuk sel model yang melingkupi koordinat pilihan pengguna. Koordinat teknis di-bucket ke resolusi 0,01° untuk efisiensi komputasi cache.</li>
          <li><strong>Estimasi US AQI PM2.5 (EPA 2024):</strong> Nilai indeks dihitung dari <strong>rerata bergerak aritmetika 24 sampel jam berturut-turut</strong> (dari H-23 hingga jam H server). Seluruh 24 sampel wajib tersedia dan valid; jika ada jam yang hilang, indeks dinyatakan tidak tersedia.</li>
          <li><strong>Breakpoint EPA 2024:</strong> Mengikuti revisi resmi US EPA (Februari 2024) untuk PM2.5: Baik (0,0–9,0 µg/m³; AQI 0–50), Sedang (9,1–35,4 µg/m³; AQI 51–100), Tidak sehat bagi kelompok sensitif (35,5–55,4 µg/m³; AQI 101–150), Tidak sehat (55,5–125,4 µg/m³; AQI 151–200), Sangat tidak sehat (125,5–225,4 µg/m³; AQI 201–300), dan Berbahaya (225,5–325,4 µg/m³; AQI 301–500). Konsentrasi di atas 325,4 µg/m³ diberi tanda <code>&gt;500</code> (di luar skala) tanpa ekstrapolasi buatan.</li>
          <li><strong>Pembeda penting:</strong> Nilai ini adalah <em>estimasi berdasarkan model atmosfer</em>, <strong>bukan Indeks Standar Pencemar Udara (ISPU) resmi KLHK RI</strong>, bukan AQI multisumber gabungan (O3, NO2, SO2, CO), dan bukan NowCast stasiun darat.</li>
          <li><strong>Horizon prakiraan:</strong> Prakiraan model tersedia hingga maksimal 48 jam ke depan. Rekomendasi tindakan tetap berlaku khusus untuk jam kini.</li>
        </ul>
        <p><strong>Lapisan warna area:</strong> Snapshot mandiri mengambil 931 posisi sampling reguler 1° (49×19) pada 94°–142° BT dan 12° LS–6° LU, termasuk laut. Model CAMS sumber sekitar 0,4°; sampling dan interpolasi bilinear tidak menambah ketelitian. Area dengan sampel hilang tetap transparan. Tersedia 25 frame per jam dari jam mulai job sampai 24 jam berikutnya, dengan penanda riwayat/jam kini/prakiraan ketika waktu berjalan. Warna menyatakan konsentrasi µg/m³, <strong>bukan AQI/ISPU</strong>, dan tidak mengubah indeks 24 jam maupun rekomendasi kini. Run model tidak disediakan provider; waktu pengambilan dicatat terpisah. Snapshot fresh kurang dari 12 jam, fallback sampai 24 jam bila frame kini tersedia; sesudah itu tidak ditampilkan.</p>
        <p>
          Rujukan resmi: <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener noreferrer">Open-Meteo Air Quality ↗</a> · <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer">Copernicus CAMS ↗</a>
        </p>
      </section>

      <section id="recommendations-methodology">
        <h2>3. Pedoman dan tindakan masyarakat</h2>
        <p>
          Rekomendasi tindakan dievaluasi secara deterministik di sisi server melalui <code>/api/recommendations</code>, mengadaptasi pedoman resmi <strong>AirNow Particle Pollution Activity Guide</strong>.
        </p>
        <ul>
          <li><strong>Tiga kelompok audiens:</strong> <em>Masyarakat umum</em>, <em>Kelompok sensitif</em> (anak-anak, lansia, penderita asma/kondisi kardiovaskular, ibu hamil), serta <em>Aktivitas luar ruang</em> (pekerja lapangan dan pelaku olahraga intensif di luar ruang yang mengadopsi tingkat kehati-hatian kelompok sensitif).</li>
          <li><strong>Mode tindakan:</strong> Mode terarah (<code>targeted</code>) hanya aktif apabila data udara berstatus sehat (<code>ok</code>), jam berlaku sesuai, dan versi data cocok. Bila data kedaluwarsa, tidak lengkap, atau sedang dimuat, sistem otomatis beralih ke mode panduan terbatas (<code>limited</code>).</li>
          <li><strong>Batasan medis:</strong> Rekomendasi bersifat panduan umum perilaku beraktivitas. Sistem <strong>tidak memberikan diagnosis medis, anjuran dosis obat, jaminan keselamatan lokasi, maupun instruksi evakuasi otomatis</strong>. Keputusan evakuasi atau tanggap darurat sepenuhnya wewenang otoritas kebencanaan resmi (BPBD/BNPB).</li>
        </ul>
        <p>
          Rujukan pedoman: <a href={ACTION_SOURCE} target="_blank" rel="noopener noreferrer">US EPA AirNow Activity Guide ↗</a>
        </p>
      </section>

      <section id="geography-methodology">
        <h2>4. Data geografis dan peta</h2>
        <p>
          Visualisasi spasial dan pencarian lokasi menggunakan data domain publik <strong>Natural Earth</strong> versi {geographyManifest.country.version} (negara) dan {geographyManifest.places.version} (tempat berpopulasi) skala 1:10.000.000.
        </p>
        <ul>
          <li><strong>Batas indikatif:</strong> Garis batas wilayah kepulauan Indonesia disederhanakan untuk efisiensi komputasi penapisan titik (point-in-polygon) dan preview visual. Garis ini <em>bukan batas hukum atau klaim perbatasan kedaulatan negara</em>.</li>
          <li><strong>Gazetteer tempat:</strong> Menyediakan 105 pusat permukiman dan kota di Indonesia untuk pencarian instan tanpa GPS. Ini bukan daftar desa/kelurahan lengkap seluruh Indonesia.</li>
          <li><strong>Overlay 38 provinsi:</strong> Dataset komunitas oleh denyherianto (commit 80aa4a9, 18 Desember 2025), lisensi CC BY 4.0. Geometri, nama dan identitas bentuk diverifikasi; asal survei upstream tidak didokumentasikan penerbit. Batas bersifat indikatif, bukan batas hukum resmi/terkini. ID bentuk Papua bukan kode administrasi resmi. Overlay ini tidak mengganti geometri penapisan negara.</li>
          <li><strong>Peta dasar:</strong> CARTO Dark Matter memakai key proyek yang tersedia dengan atribusi © OpenStreetMap contributors, © CARTO. Jika key tidak dikonfigurasi, Map memakai Esri Dark Gray Canvas dan label Reference. Satellite memakai World Imagery dengan kredit Esri dan penyedia citra yang tercantum pada sumber; umur citra berbeda dari waktu deteksi/model udara.</li>
          <li><strong>Globe dan Terrain:</strong> Globe adalah proyeksi tampilan; Terrain menambahkan elevasi model Mapzen Terrain Tiles dari AWS Open Data, encoding Terrarium, exaggeration 1. Elevasi tidak digunakan untuk menghitung hotspot, kualitas udara atau rekomendasi. Kamera global tidak memperluas cakupan data Indonesia; hitungan daftar mengikuti kotak cakupan geografis viewport, bukan area pandang permukaan yang presisi.</li>
        </ul>
        <p>
          Rujukan dataset: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth Data ↗</a> · <a href="https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces/tree/80aa4a90ac7eef5136eaa2b551b6aa5d198be27d">Dataset provinsi komunitas ↗</a> · <a href="/data/provinces-LICENSE.md">Lisensi batas CC BY 4.0 ↗</a> · <a href="https://carto.com/basemaps/" target="_blank" rel="noopener noreferrer">CARTO Basemaps ↗</a> · <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">World Imagery & kredit ↗</a> · <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles ↗</a> · <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Atribusi elevasi ↗</a>
        </p>
      </section>

      <section id="state-methodology">
        <h2>5. Transparansi kesegaran dan status data</h2>
        <p>
          Aplikasi membedakan secara tegas kondisi kualitas data menggunakan empat status standar:
        </p>
        <ul>
          <li><code>ok</code>: Data berhasil dimuat, lengkap, dan masih berada dalam masa berlaku kesegaran.</li>
          <li><code>stale</code>: Waktu berlaku data telah terlampaui tetapi data terakhir masih dapat ditampilkan sebagai referensi sementara dengan penanda jelas bahwa data sudah usang. Tindakan terarah otomatis dinonaktifkan.</li>
          <li><code>partial</code>: Sebagian sumber data berhasil diambil namun sumber lainnya mengalami gangguan (misal: hanya 2 dari 3 satelit VIIRS yang selesai). Nilai nol tidak diklaim sebagai kondisi nihil nasional.</li>
          <li><code>unavailable</code>: Data belum tersedia atau gagal diambil. Aplikasi menuliskan alasan kendala tanpa mengganti angka kosong dengan angka nol.</li>
        </ul>
      </section>

      <section id="correction-channel">
        <h2>6. Jalur koreksi dan masukan metodologi</h2>
        <p>
          Ketepatan data dan kesesuaian metode merupakan prioritas utama Lentera Karhutla. Jika Anda menemukan ketidaksesuaian nama lokasi, koordinat geografi, kejanggalan dalam penghitungan indeks, atau kesalahan teks pada adaptasi pedoman tindakan:
        </p>
        <div className="correction-box">
          <p><strong>Cara menyampaikan koreksi atau laporan masalah:</strong></p>
          <ul>
            <li><strong>Repositori GitHub:</strong> Ajukan issue atau pull request perbaikan melalui <a href="https://github.com/dulabdul/LENTERA-CP109/issues" target="_blank" rel="noopener noreferrer">GitHub Issues LENTERA-CP109 ↗</a>. Cantumkan nama lokasi, koordinat (lat, lon), waktu kejadian (UTC/WIB), dan tangkapan layar jika relevan.</li>
            <li><strong>Kontak email pemelihara:</strong> Kirimkan penjelasan teknis atau pertanyaan metodologi ke <a href="mailto:dul.abdoel21@gmail.com">dul.abdoel21@gmail.com</a> dengan subjek <code>[Koreksi Data Lentera]</code>.</li>
          </ul>
          <p className="field-help">
            Setiap laporan koreksi akan diverifikasi terhadap kontrak data dan log sumber upstream sebelum dilakukan pembaruan dataset atau revisi aturan.
          </p>
        </div>
      </section>

      <nav className="page-navigation-links" aria-label="Navigasi halaman terkait">
        <Link href="/peta" className="primary-link">Buka peta monitoring ↗</Link>
        <Link href="/privasi">Baca kebijakan privasi ↗</Link>
      </nav>
    </main>
  );
}
