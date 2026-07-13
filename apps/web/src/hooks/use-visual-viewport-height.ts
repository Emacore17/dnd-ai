"use client";

import { useSyncExternalStore } from "react";

const serverViewportHeight = 0;

function readViewportHeight(): number {
  if (typeof window === "undefined") {
    return serverViewportHeight;
  }

  const visualHeight = window.visualViewport?.height;
  const availableHeight =
    visualHeight && Number.isFinite(visualHeight)
      ? visualHeight
      : window.innerHeight;

  return Math.max(0, Math.round(availableHeight));
}

function subscribeToViewport(onViewportChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const visualViewport = window.visualViewport;
  const listenerOptions: AddEventListenerOptions = { passive: true };

  window.addEventListener("resize", onViewportChange, listenerOptions);
  window.addEventListener("scroll", onViewportChange, listenerOptions);
  visualViewport?.addEventListener("resize", onViewportChange, listenerOptions);
  visualViewport?.addEventListener("scroll", onViewportChange, listenerOptions);

  return () => {
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("scroll", onViewportChange);
    visualViewport?.removeEventListener("resize", onViewportChange);
    visualViewport?.removeEventListener("scroll", onViewportChange);
  };
}

export function useVisualViewportHeight(): number {
  return useSyncExternalStore(
    subscribeToViewport,
    readViewportHeight,
    () => serverViewportHeight,
  );
}
