"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlanIcon, ProfileIcon, RecipesIcon, TodayIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export const TABS = [
  { href: "/home", label: "Hoy", Icon: TodayIcon, match: ["/home", "/progress"] },
  { href: "/plan", label: "Plan", Icon: PlanIcon, match: ["/plan", "/shopping"] },
  { href: "/recipes", label: "Recetas", Icon: RecipesIcon, match: ["/recipes"] },
  { href: "/profile", label: "Perfil", Icon: ProfileIcon, match: ["/profile"] },
] as const;

/** Rutas que muestran la barra de navegación inferior */
export function showsBottomNav(pathname: string): boolean {
  return TABS.some((t) => t.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)));
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-border-subtle bg-bg-surface/90 backdrop-blur-md pb-safe"
    >
      <ul className="max-w-md mx-auto grid grid-cols-4">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 pt-2.5 pb-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-text-secondary hover:text-text-primary",
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
