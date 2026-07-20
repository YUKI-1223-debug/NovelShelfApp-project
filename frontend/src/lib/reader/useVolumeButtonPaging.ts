"use client";

import { useEffect, useRef } from "react";

// 無音のWAV（4kHz, 8bit, モノラル, 約0.25秒, 全サンプル無音）。audio要素をループ再生し続けることで、
// Android Chromeはハードウェア音量ボタンの操作を「再生中メディアのボリュームストリーム」に
// 割り当てる。これにより<audio>のvolumechangeイベントで音量ボタンの押下方向（上/下）を検知できる。
// iOS Safariはこの仕組み自体に対応していない（JSから音量変更を検知できない）ため、この機能は
// Android Chrome系ブラウザでのみ動作する。
const SILENT_WAV =
  "data:audio/wav;base64,UklGRgwEAABXQVZFZm10IBAAAAABAAEAoA8AAKAPAAABAAgAZGF0YegDAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

export function useVolumeButtonPaging(enabled: boolean, onNext: () => void, onPrev: () => void) {
  const onNextRef = useRef(onNext);
  const onPrevRef = useRef(onPrev);
  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);
  useEffect(() => {
    onPrevRef.current = onPrev;
  }, [onPrev]);

  useEffect(() => {
    if (!enabled) return;

    const audio = new Audio(SILENT_WAV);
    audio.loop = true;
    const RESET_VOLUME = 0.5;
    audio.volume = RESET_VOLUME;

    const tryPlay = () => {
      audio.play().catch(() => {});
    };
    tryPlay();

    // Chromeの自動再生ポリシーで初回play()がブロックされた場合に備え、
    // 何らかのユーザー操作が起きた時点で再試行する。
    const retryOnGesture = () => tryPlay();
    document.addEventListener("touchstart", retryOnGesture, { once: true });
    document.addEventListener("pointerdown", retryOnGesture, { once: true });

    const onVolumeChange = () => {
      if (audio.volume > RESET_VOLUME) {
        onPrevRef.current();
      } else if (audio.volume < RESET_VOLUME) {
        onNextRef.current();
      }
      // 上下どちらの押下も検知できるよう、常に中間値へ戻しておく。
      audio.volume = RESET_VOLUME;
    };
    audio.addEventListener("volumechange", onVolumeChange);

    const onVisibilityChange = () => {
      if (document.hidden) {
        audio.pause();
      } else {
        tryPlay();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("touchstart", retryOnGesture);
      document.removeEventListener("pointerdown", retryOnGesture);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      audio.removeEventListener("volumechange", onVolumeChange);
      audio.pause();
      audio.src = "";
    };
  }, [enabled]);
}
