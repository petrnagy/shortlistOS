import type { ReactNode } from "react";
import type { Placement } from "tippy.js";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import tippy from "tippy.js";

interface TooltipProps {
  children: ReactNode;
  className?: string;
  content?: ReactNode;
  placement?: Placement;
  delay?: number | [number, number];
}

export function Tooltip({
  children,
  className = "inline-flex",
  content,
  placement = "bottom",
  delay = [500, 0],
}: TooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerRef.current) return;

    if (!content) return;

    const container = document.createElement("div");
    const root = createRoot(container);
    root.render(content);

    const instance = tippy(triggerRef.current, {
      content: container,
      placement,
      delay,
      interactive: false,
      theme: "tooltip",
      touch: false,
    });

    return () => {
      instance.destroy();
      window.setTimeout(() => root.unmount(), 0);
    };
  }, [content, placement, delay]);

  return (
    <div ref={triggerRef} className={className}>
      {children}
    </div>
  );
}
