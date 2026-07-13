"use client";

import { LazyMotion, MotionConfig, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const enterTransition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
} as const;

const loadGameMotionFeatures = () =>
  import("@/components/motion/game-motion-features").then(
    (module) => module.default,
  );

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

interface GameMotionProviderProps {
  children: ReactNode;
}

interface GameMotionProps {
  children: ReactNode;
  className?: string;
}

interface CanonicalResultMotionProps {
  children: ReactNode;
  result: number;
}

function useMotionPreference(): {
  shouldAnimate: boolean;
  shouldReduceMotion: boolean;
} {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const shouldReduceMotion = useReducedMotion() === true;

  return {
    shouldAnimate: isHydrated && !shouldReduceMotion,
    shouldReduceMotion,
  };
}

export function GameMotionProvider({ children }: GameMotionProviderProps) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadGameMotionFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}

export function GameMotion({ children, className }: GameMotionProps) {
  const { shouldAnimate: shouldAnimateEntrance, shouldReduceMotion } =
    useMotionPreference();

  return (
    <m.div
      animate={{ y: 0 }}
      className={className}
      data-game-motion="entrance"
      exit={shouldReduceMotion ? { y: 0 } : { y: -4 }}
      initial={shouldAnimateEntrance ? { y: 8 } : false}
      transition={shouldReduceMotion ? { duration: 0 } : enterTransition}
    >
      {children}
    </m.div>
  );
}

export function CanonicalResultMotion({
  children,
  result,
}: CanonicalResultMotionProps) {
  const { shouldAnimate } = useMotionPreference();

  return (
    <m.span
      animate={{ rotate: 0, scale: 1 }}
      className="inline-grid"
      data-canonical-result={result}
      data-game-motion="canonical-result"
      initial={shouldAnimate ? { rotate: -36, scale: 0.82 } : false}
      transition={shouldAnimate ? enterTransition : { duration: 0 }}
    >
      {children}
    </m.span>
  );
}
