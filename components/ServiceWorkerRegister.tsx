"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installing the PWA shell is a nice-to-have; ignore failures
        // (e.g. unsupported browser, or dev environments without HTTPS).
      });
    }
  }, []);

  return null;
}
