"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, HistoryIcon, NotesIcon, SettingsIcon } from "@/components/icons";
import GlobalAddReadingFab from "@/components/GlobalAddReadingFab";

const leftItems = [
  { href: "/", label: "Início", Icon: HomeIcon },
  { href: "/historico", label: "Histórico", Icon: HistoryIcon },
];

const rightItems = [
  { href: "/anotacoes", label: "Anotações", Icon: NotesIcon },
  { href: "/configuracoes", label: "Ajustes", Icon: SettingsIcon },
];

function NavLink({ href, label, Icon, active }: { href: string; label: string; Icon: any; active: boolean }) {
  return (
    <Link href={href} className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon size={20} />
      {label}
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {leftItems.map((item) => (
        <NavLink key={item.href} {...item} active={pathname === item.href} />
      ))}

      <div className="nav-fab-slot">
        <GlobalAddReadingFab />
      </div>

      {rightItems.map((item) => (
        <NavLink key={item.href} {...item} active={pathname === item.href} />
      ))}
    </nav>
  );
}
