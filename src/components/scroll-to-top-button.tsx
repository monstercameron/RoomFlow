"use client";

import { useEffect, useState } from "react";

const visibilityThreshold = 220;

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const scrollContainer = document.querySelector<HTMLElement>("[data-app-scroll-container]");

    if (!scrollContainer) {
      return;
    }

    const updateVisibility = () => {
      setIsVisible(scrollContainer.scrollTop > visibilityThreshold);
    };

    updateVisibility();
    scrollContainer.addEventListener("scroll", updateVisibility, { passive: true });

    return () => {
      scrollContainer.removeEventListener("scroll", updateVisibility);
    };
  }, []);

  function handleClick() {
    const scrollContainer = document.querySelector<HTMLElement>("[data-app-scroll-container]");

    scrollContainer?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <button
      aria-hidden={!isVisible}
      aria-label="Scroll to top"
      className={`fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(184,88,51,0.28)] bg-[var(--color-accent)] text-lg font-semibold text-white shadow-[0_18px_40px_rgba(141,63,33,0.24)] transition-all duration-200 hover:bg-[var(--color-accent-strong)] md:bottom-8 md:right-8 ${
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
      onClick={handleClick}
      type="button"
    >
      ↑
    </button>
  );
}