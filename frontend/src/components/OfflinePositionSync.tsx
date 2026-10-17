"use client";

import { useEffect } from "react";
import { flushPendingPositions } from "@/lib/offline/positionQueue";
import { RECONNECTED_EVENT } from "@/components/ConnectionBanner";

export function OfflinePositionSync() {
  useEffect(() => {
    flushPendingPositions().catch(() => {});

    function handleOnline() {
      flushPendingPositions().catch(() => {});
    }

    // "online" は端末のネットワークが戻ったとき。Tailscale を ON に戻した・ミニPCが休止から戻ったときは
    // "online" が来ないので、ConnectionBanner がサーバーにつながったと判断したとき(RECONNECTED_EVENT)にも送る
    window.addEventListener("online", handleOnline);
    window.addEventListener(RECONNECTED_EVENT, handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(RECONNECTED_EVENT, handleOnline);
    };
  }, []);

  return null;
}
