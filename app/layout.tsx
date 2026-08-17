import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
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
  themeColor: "#16C76A",
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
                <svg width="18" height="18" viewBox="0 0 512 512">
                  <path d="M282 74 153 282h99l-28 156 135-224h-99z" fill="#fff" />
                  <path d="M104 362c48-30 92-46 152-68" fill="none" stroke="#fff" strokeWidth="34" strokeLinecap="round" opacity=".92" />
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
