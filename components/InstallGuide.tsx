"use client";

import { useEffect, useState } from "react";

export function useIsInstalled() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari exposes this non-standard property when installed.
      (window.navigator as any).standalone === true;
    setInstalled(Boolean(standalone));
  }, []);

  return installed;
}

export default function InstallGuide({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<"android" | "ios">("android");

  useEffect(() => {
    if (!open) return;
    const ua = navigator.userAgent.toLowerCase();
    setPlatform(/iphone|ipad|ipod/.test(ua) ? "ios" : "android");
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="section-title" style={{ marginBottom: 14 }}>
          Como instalar o Wattly
        </h2>

        <div className="platform-tabs">
          <button
            className={`platform-tab${platform === "android" ? " active" : ""}`}
            onClick={() => setPlatform("android")}
          >
            Android
          </button>
          <button
            className={`platform-tab${platform === "ios" ? " active" : ""}`}
            onClick={() => setPlatform("ios")}
          >
            iPhone
          </button>
        </div>

        {platform === "android" ? (
          <ol className="install-steps">
            <li>Abra o Wattly no navegador Chrome.</li>
            <li>Toque no menu com três pontinhos, no canto superior direito.</li>
            <li>Toque em "Instalar aplicativo" ou "Adicionar à tela inicial".</li>
            <li>Confirme tocando em "Instalar". O ícone do Wattly vai aparecer na sua tela inicial.</li>
          </ol>
        ) : (
          <ol className="install-steps">
            <li>Abra o Wattly no navegador Safari (precisa ser o Safari, não outro app).</li>
            <li>Toque no ícone de compartilhar (o quadrado com a seta pra cima), na barra inferior.</li>
            <li>Role a lista de opções e toque em "Adicionar à Tela de Início".</li>
            <li>Toque em "Adicionar", no canto superior direito. O ícone do Wattly vai aparecer na sua tela inicial.</li>
          </ol>
        )}

        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
