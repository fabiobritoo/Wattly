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

// The Anotações screen already has its own full-width "+ Nova anotação"
// button doing a *different* thing (adds a note, not a reading). Showing
// the global FAB there too means two unlabeled "+" controls stacked on
// top of each other with different actions — confusing regardless of the
// FAB's aria-label, since the ambiguity is visual, not just for screen
// readers. Hide the FAB only on that one screen; keep the slot so the
// nav items don't shift.
const FAB_HIDDEN_ON = new Set(["/anotacoes"]);

export default function BottomNav() {
  const pathname = usePathname();
  const showFab = !FAB_HIDDEN_ON.has(pathname);

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {leftItems.map((item) => (
        <NavLink key={item.href} {...item} active={pathname === item.href} />
      ))}

      <div className="nav-fab-slot">{showFab && <GlobalAddReadingFab />}</div>

      {rightItems.map((item) => (
        <NavLink key={item.href} {...item} active={pathname === item.href} />
      ))}
    </nav>
  );
}
