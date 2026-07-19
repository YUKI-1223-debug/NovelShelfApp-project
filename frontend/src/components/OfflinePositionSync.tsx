"use client";

import { useEffect } from "react";
import { flushPendingPositions } from "@/lib/offline/positionQueue";

export function OfflinePositionSync() {
  useEffect(() => {
    flushPendingPositions().catch(() => {});

    function handleOnline() {
      flushPendingPositions().catch(() => {});
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}
