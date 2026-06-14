import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/t";

type MarketingShellProps = {
  children: React.ReactNode;
  activeNav?: "home" | "roadmap";
};

export async function MarketingShell({ children, activeNav }: MarketingShellProps) {
  const t = await getT("association");
  const tc = await getT("common");

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-encre focus:px-4 focus:py-2 focus:text-white"
      >
        {tc("skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-canal bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo alt={tc("appName")} href="/" size="sm" />
          <nav className="flex items-center gap-1 sm:gap-2" aria-label={t("footer.nav")}>
            <Button
              asChild
              variant={activeNav === "home" ? "default" : "ghost"}
              size="sm"
            >
              <Link href="/">{t("nav.home")}</Link>
            </Button>
            <Button
              asChild
              variant={activeNav === "roadmap" ? "default" : "ghost"}
              size="sm"
            >
              <Link href="/roadmap">{t("nav.roadmap")}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">{t("nav.login")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">{t("nav.signup")}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-canal bg-encre-muted/20 px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2">
          <div>
            <BrandLogo alt={tc("appName")} href="/" size="sm" />
            <p className="mt-4 text-sm text-ardoise/70">{t("footer.tagline")}</p>
            <p className="mt-2 text-sm text-ardoise/50">{t("footer.mission")}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-ardoise">{t("footer.nav")}</p>
            <ul className="mt-3 space-y-2 text-sm text-ardoise/70">
              <li>
                <Link href="/" className="hover:text-encre">
                  {t("nav.home")}
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className="hover:text-encre">
                  {t("nav.roadmap")}
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-encre">
                  {t("nav.signup")}
                </Link>
              </li>
            </ul>
            <p className="mt-6 text-xs text-ardoise/40">{t("footer.values")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
