"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, HistoryIcon, NotesIcon, SettingsIcon } from "@/components/icons";

const items = [
  { href: "/", label: "Início", Icon: HomeIcon },
  { href: "/historico", label: "Histórico", Icon: HistoryIcon },
  { href: "/anotacoes", label: "Anotações", Icon: NotesIcon },
  { href: "/configuracoes", label: "Ajustes", Icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
