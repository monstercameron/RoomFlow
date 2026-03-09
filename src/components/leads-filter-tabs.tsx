"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";

type LeadsFilterTabItem = {
  description: string;
  href: string;
  label: string;
  value: string;
};

type IndicatorBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type LeadsFilterTabsProps = {
  activeValue: string;
  items: LeadsFilterTabItem[];
};

function resolveIndicatorBox(
  container: HTMLDivElement | null,
  item: HTMLElement | null,
): IndicatorBox | null {
  if (!container || !item) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();

  return {
    height: itemRect.height,
    width: itemRect.width,
    x: itemRect.left - containerRect.left,
    y: itemRect.top - containerRect.top,
  };
}

function toIndicatorStyle(box: IndicatorBox | null): CSSProperties {
  if (!box) {
    return {
      opacity: 0,
      transform: "translate3d(0, 0, 0)",
    };
  }

  return {
    height: `${box.height}px`,
    opacity: 1,
    transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
    width: `${box.width}px`,
  };
}

export function LeadsFilterTabs({ activeValue, items }: LeadsFilterTabsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);
  const [activeIndicatorBox, setActiveIndicatorBox] = useState<IndicatorBox | null>(null);
  const [previewIndicatorBox, setPreviewIndicatorBox] = useState<IndicatorBox | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  const displayedActiveValue = optimisticValue ?? activeValue;

  const syncIndicators = useCallback(() => {
    const container = containerRef.current;
    const activeNode = itemRefs.current.get(displayedActiveValue) ?? null;
    const previewNode = hoveredValue ? itemRefs.current.get(hoveredValue) ?? null : null;

    setActiveIndicatorBox(resolveIndicatorBox(container, activeNode));
    setPreviewIndicatorBox(
      hoveredValue && hoveredValue !== displayedActiveValue
        ? resolveIndicatorBox(container, previewNode)
        : null,
    );
  }, [displayedActiveValue, hoveredValue]);

  useLayoutEffect(() => {
    syncIndicators();

    const container = containerRef.current;

    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      syncIndicators();
    });

    resizeObserver.observe(container);

    for (const itemNode of itemRefs.current.values()) {
      resizeObserver.observe(itemNode);
    }

    window.addEventListener("resize", syncIndicators);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncIndicators);
    };
  }, [items, syncIndicators]);

  useLayoutEffect(() => {
    if (optimisticValue === activeValue) {
      setOptimisticValue(null);
    }
  }, [activeValue, optimisticValue]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-wrap items-center gap-2"
      onMouseLeave={() => setHoveredValue(null)}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 rounded-full border border-[rgba(184,88,51,0.24)] bg-[rgba(184,88,51,0.12)] shadow-[inset_0_1px_0_rgba(255,255,255,0.52),0_10px_22px_rgba(141,63,33,0.07)] transition-[transform,width,height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={toIndicatorStyle(activeIndicatorBox)}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 rounded-full border border-[rgba(184,88,51,0.18)] bg-[rgba(184,88,51,0.06)] transition-[transform,width,height,opacity] duration-200 ease-out"
        style={toIndicatorStyle(previewIndicatorBox)}
      />
      {items.map((item) => {
        const isActive = item.value === displayedActiveValue;

        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) {
                itemRefs.current.set(item.value, node);
                return;
              }

              itemRefs.current.delete(item.value);
            }}
            aria-pressed={isActive}
            className={`relative z-10 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 ${
              isActive
                ? "border-transparent bg-transparent text-[var(--color-accent-strong)]"
                : "border-[var(--color-line)] bg-[var(--color-panel-strong)] text-[var(--color-muted)] hover:border-[rgba(184,88,51,0.16)] hover:bg-[rgba(255,255,255,0.98)] hover:text-[var(--color-ink)]"
            } ${isPending ? "cursor-progress" : "cursor-pointer"}`}
            disabled={isPending && isActive}
            onClick={() => {
              if (item.value === activeValue) {
                return;
              }

              setOptimisticValue(item.value);

              startTransition(() => {
                router.push(item.href, { scroll: false });
              });
            }}
            onFocus={() => setHoveredValue(item.value)}
            onMouseEnter={() => setHoveredValue(item.value)}
            type="button"
            title={item.description}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}