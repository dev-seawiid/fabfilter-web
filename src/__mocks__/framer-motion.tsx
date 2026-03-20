/**
 * Framer Motion Mock — 테스트 환경에서 애니메이션을 비활성화하고
 * 순수 HTML 요소로 대체한다.
 *
 * vi.mock("framer-motion") 대신 이 파일을 import하여 사용:
 *   vi.mock("framer-motion", () => import("@/__mocks__/framer-motion"));
 */

import React from "react";

type MotionProps = Record<string, unknown> & {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

// framer-motion의 motion props 중 DOM에 전달하면 안 되는 것들
const MOTION_PROP_KEYS = [
  "whileTap",
  "whileHover",
  "whileFocus",
  "whileDrag",
  "whileInView",
  "layoutId",
  "layout",
  "initial",
  "animate",
  "exit",
  "transition",
  "variants",
  "drag",
  "dragConstraints",
  "onAnimationStart",
  "onAnimationComplete",
] as const;

function filterMotionProps(props: MotionProps): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!(MOTION_PROP_KEYS as readonly string[]).includes(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

function createMotionComponent(tag: string) {
  const Component = React.forwardRef<unknown, MotionProps>((props, ref) => {
    const filtered = filterMotionProps(props);
    return React.createElement(tag, { ...filtered, ref });
  });
  Component.displayName = `motion.${tag}`;
  return Component;
}

export const motion = {
  div: createMotionComponent("div"),
  button: createMotionComponent("button"),
  span: createMotionComponent("span"),
  p: createMotionComponent("p"),
  a: createMotionComponent("a"),
  input: createMotionComponent("input"),
  svg: createMotionComponent("svg"),
};

export function AnimatePresence({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
