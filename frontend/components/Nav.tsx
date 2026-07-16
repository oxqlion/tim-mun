"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

export default function Nav({ links }: { links: { href: string; label: string }[] }) {
  const router = useRouter();

  return (
    <nav className="flex items-center justify-between border-b border-black/10 px-6 py-4">
      <div className="flex items-center gap-6">
        <span className="font-semibold">Agri-logistics</span>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm text-black/70 hover:text-black">
            {link.label}
          </Link>
        ))}
      </div>
      <button
        onClick={() => {
          logout();
          router.replace("/login");
        }}
        className="text-sm text-black/50 hover:text-black"
      >
        Log out
      </button>
    </nav>
  );
}
