"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Only track high-level pages to save database writes
const TRACKED_PATHS = [
  "/shopper",
  "/shopping",
  "/checkout",
  "/shop-owner",
  "/market-owner",
  "/admin"
];

export default function ActivityTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    // Check if the current pathname matches one of the high-level paths
    // e.g. /en/shopper matches /shopper
    const isTracked = TRACKED_PATHS.some(path => pathname.endsWith(path) || pathname.includes(`${path}/`));

    if (isTracked && lastTrackedPath.current !== pathname) {
      lastTrackedPath.current = pathname;
      
      // Debounce slightly to avoid double logs on quick redirects
      const timer = setTimeout(() => {
        fetch("/api/logger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "VISIT",
            details: pathname
          })
        }).catch(e => console.error("ActivityTracker error:", e));
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return null; // This component doesn't render anything
}
