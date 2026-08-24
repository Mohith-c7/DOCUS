'use client';

import React, { useEffect, useState, CSSProperties } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnimationType = 'fade-up' | 'fade-in' | 'scale-in';

export interface AnimatedContainerProps {
  children: React.ReactNode;
  /** Delay before the animation starts, in milliseconds. Default: 0 */
  delay?: number;
  /** The animation style to apply on mount. Default: 'fade-up' */
  animation?: AnimationType;
  /** Optional extra className for the wrapper div */
  className?: string;
  /** Optional extra inline styles merged onto the wrapper div */
  style?: CSSProperties;
}

// ─── Initial / final states per animation type ────────────────────────────────

type TransitionState = {
  opacity: number;
  transform: string;
};

const INITIAL_STATE: Record<AnimationType, TransitionState> = {
  'fade-up': { opacity: 0, transform: 'translateY(18px)' },
  'fade-in': { opacity: 0, transform: 'none' },
  'scale-in': { opacity: 0, transform: 'scale(0.94)' },
};

const FINAL_STATE: TransitionState = {
  opacity: 1,
  transform: 'none',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * `AnimatedContainer` wraps any children in a div that animates on mount.
 *
 * Usage:
 * ```tsx
 * <AnimatedContainer animation="fade-up" delay={100}>
 *   <MyCard />
 * </AnimatedContainer>
 * ```
 */
export function AnimatedContainer({
  children,
  delay = 0,
  animation = 'fade-up',
  className,
  style,
}: AnimatedContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use a timeout to respect the `delay` prop and ensure the browser has
    // painted the initial (hidden) state before triggering the transition.
    const timer = setTimeout(() => {
      setMounted(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const initial = INITIAL_STATE[animation];
  const current = mounted ? FINAL_STATE : initial;

  // Only apply a transition when we're not in the initial hidden state,
  // to avoid a flash during SSR hydration.
  const transitionStyle: CSSProperties = {
    opacity: current.opacity,
    transform: current.transform,
    transition: mounted
      ? 'opacity 0.38s ease, transform 0.38s cubic-bezier(0.21, 0.98, 0.60, 1)'
      : 'none',
    willChange: 'opacity, transform',
  };

  return (
    <div
      className={className}
      style={{
        ...transitionStyle,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default AnimatedContainer;
