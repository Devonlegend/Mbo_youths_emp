"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/services/auth";

export function useRoleGuard(allowedRoles, redirectTo = "/admin") {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await getMe();
        if (cancelled) return;

        if (!allowedRoles.includes(res.data.role)) {
          router.replace(redirectTo);
        } else {
          setUser(res.data);
          setChecking(false);
        }
      } catch {
        if (!cancelled) router.replace("/login");
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  return { user, checking };
}