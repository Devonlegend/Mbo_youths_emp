import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/services";

const TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes, matches backend access token lifetime

export function useInactivityLogout() {
  const router   = useRouter();
  const timerRef = useRef(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        await logout();
        router.push("/login");
      }, TIMEOUT_MS);
    }

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "touchmove",
      "scroll",
      "click",
    ];

    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);
}