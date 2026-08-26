"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/deposit-borrow", label: "Deposit / Borrow" },
  { href: "/health", label: "Health" },
  { href: "/repay-withdraw", label: "Repay / Withdraw" },
  { href: "/liquidate", label: "Liquidate" },
];

/** trailingSlash: true (see next.config.ts) makes usePathname() return e.g. "/health/" — normalize before comparing. */
function normalizePath(path: string): string {
  return path.length > 1 ? path.replace(/\/$/, "") : path;
}

export function Nav() {
  const pathname = normalizePath(usePathname());

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-ink/80 px-6 py-5 backdrop-blur-md sm:px-10">
      <Link href="/" className="display-section text-lg text-bone">
        SOLVENT
      </Link>
      <nav className="hidden gap-8 text-sm text-muted md:flex">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group relative py-1 transition-colors ${
                active ? "text-bone" : "hover:text-bone"
              }`}
            >
              {link.label}
              <span
                className={`absolute -bottom-0.5 left-0 h-px bg-accent transition-all duration-300 ${
                  active ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </Link>
          );
        })}
      </nav>
      <ConnectButton showBalance={false} />
    </header>
  );
}
