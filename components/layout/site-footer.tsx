import Link from "next/link";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-ink/58 md:justify-start">
          <Link href="/terms" className="transition hover:text-bronze">
            Terms
          </Link>
          <Link href="/privacy" className="transition hover:text-bronze">
            Privacy
          </Link>
          <Link href="/disclaimer" className="transition hover:text-bronze">
            Disclaimer
          </Link>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-ink/50">
          CarNest is a platform connecting private buyers and sellers. All transactions are conducted independently.
        </p>
        <p className="mt-2 text-sm text-ink/45">© {currentYear} CarNest. All rights reserved.</p>
      </div>
    </footer>
  );
}
