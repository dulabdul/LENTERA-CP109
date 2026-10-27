import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Lentera Karhutla — beranda">
        <span className="brand-symbol" aria-hidden="true">✳</span>
        <span>LENTERA<span className="brand-sub">KARHUTLA</span></span>
      </Link>
      <nav aria-label="Navigasi utama">
        <Link href="/peta">Pantau lokasi <span aria-hidden="true">↗</span></Link>
        <Link href="/sumber-data">Sumber & metode</Link>
        <Link href="/privasi">Privasi</Link>
      </nav>
    </header>
  );
}
