"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, BookmarkIcon, SearchIcon, SettingsIcon, ShelfIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "本棚", icon: ShelfIcon },
  { href: "/search", label: "検索", icon: SearchIcon },
  { href: "/updates", label: "更新", icon: BellIcon },
  { href: "/bookmarks", label: "しおり", icon: BookmarkIcon },
  { href: "/settings", label: "設定", icon: SettingsIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-border bg-card">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${
              active ? "text-accent" : "text-muted"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
