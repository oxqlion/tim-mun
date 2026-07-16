"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRole, isAuthenticated } from "@/lib/auth";
import type { Role } from "@/types/api";

export default function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated() || getRole() !== role) {
      router.replace("/login");
      return;
    }
    // One-time auth gate on mount, not a response to external state changing —
    // the documented cascading-render concern doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [role, router]);

  if (!ready) return null;
  return <>{children}</>;
}
