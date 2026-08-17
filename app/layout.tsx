import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { APP_VERSION } from "@/lib/version";

export const metadata: Metadata = {
  title: "Wattly — Entenda seu consumo",
  description: "Monitor pessoal de consumo de energia. Veja hoje. Preveja amanhã.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wattly",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#22C55E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ServiceWorkerRegister />
        <div className="app-shell">
          <header className="app-header">
            <div className="brand">
              <div className="brand-mark" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2 6 14h5l-1 8 8-12h-5l1-8Z" fill="#fff" />
                </svg>
              </div>
              <span className="brand-name">Wattly</span>
            </div>
            <span className="version-tag">v{APP_VERSION}</span>
          </header>
          <main className="app-main">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
