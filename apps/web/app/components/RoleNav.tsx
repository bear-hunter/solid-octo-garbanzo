"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const LINKS = [
  { href: "/issuer", label: "Issuer" },
  { href: "/holder", label: "Holder" },
  { href: "/verify", label: "Verifier" },
];

export default function RoleNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Roles">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? "active" : ""}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
