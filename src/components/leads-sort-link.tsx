"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent, type ReactNode } from "react";

export function LeadsSortLink({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className: string;
  href: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    document.getElementById("leads-list-top")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <Link className={className} href={href} onClick={handleClick} scroll={false}>
      {children}
    </Link>
  );
}