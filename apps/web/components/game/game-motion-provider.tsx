"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { PropsWithChildren } from "react";

const loadGameMotionFeatures = () =>
  import("./game-motion-features").then((module) => module.default);

export function GameMotionProvider({ children }: PropsWithChildren) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadGameMotionFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
