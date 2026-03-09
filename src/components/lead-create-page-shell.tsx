"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const LeadCreatePageShellContext = createContext<{
  navigateWithExit: (href: string) => void;
} | null>(null);

export function LeadCreatePageShell({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const router = useRouter();
  const navigationTimeoutReference = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const animationFrame = requestAnimationFrame(() => {
      setIsReady(true);
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (navigationTimeoutReference.current) {
        clearTimeout(navigationTimeoutReference.current);
      }
    };
  }, []);

  function navigateWithExit(href: string) {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    navigationTimeoutReference.current = setTimeout(() => {
      router.push(href);
    }, 220);
  }

  return (
    <LeadCreatePageShellContext.Provider value={{ navigateWithExit }}>
      <div className="relative">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-8 top-6 h-28 rounded-full bg-[rgba(184,88,51,0.12)] blur-3xl transition-all duration-500 ${
            isReady && !isExiting ? "opacity-100 scale-100" : "opacity-0 scale-90"
          }`}
        />
        <div
          className={`relative transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isExiting
              ? "-translate-y-4 scale-[0.985] opacity-0 blur-[2px]"
              : isReady
                ? "translate-y-0 scale-100 opacity-100 blur-0"
                : "translate-y-6 scale-[0.985] opacity-0 blur-[2px]"
          }`}
        >
          {children}
        </div>
      </div>
    </LeadCreatePageShellContext.Provider>
  );
}

export function LeadCreateBackLink({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className: string;
  href: string;
}) {
  const context = useContext(LeadCreatePageShellContext);

  if (!context) {
    return null;
  }

  return (
    <button
      className={className}
      onClick={() => context.navigateWithExit(href)}
      type="button"
    >
      {children}
    </button>
  );
}