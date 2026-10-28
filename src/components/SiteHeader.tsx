import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="LENTERA — beranda">
        <span className="brand-symbol" aria-hidden="true"><span /></span>
        <span>LENTERA</span>
      </Link>
      <nav aria-label="Navigasi utama">
        <Link href="/" className="nav-home">Beranda</Link>
        <Link href="/sumber-data">Sumber & metode</Link>
        <Link href="/privasi">Privasi</Link>
        <div className="nav-actions">
          <Link href="/peta" className="nav-primary">Pantau lokasi <span aria-hidden="true">↗</span></Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
