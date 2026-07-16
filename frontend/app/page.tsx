"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRole, isAuthenticated } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const role = getRole();
    router.replace(role === "logistics" ? "/logistics/dashboard" : "/warehouse/dashboard");
  }, [router]);

  return null;
}
