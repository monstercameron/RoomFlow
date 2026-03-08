import Link from "next/link";

type PublicNavLink = {
  href: string;
  label: string;
};

type PublicPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
};

const navLinks: PublicNavLink[] = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/ai-tools", label: "AI tools" },
];

export function PublicHeader() {
  return (
    <header className="flex flex-col gap-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-4 shadow-[var(--shadow-panel)] backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <Link className="text-lg font-semibold tracking-tight" href="/">
          Roomflow
        </Link>
        <div className="text-sm text-[var(--color-muted)]">
          Shared-housing qualification and prospect follow-through.
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-muted)]">
        {navLinks.map((navLink) => (
          <Link key={navLink.href} className="rounded-full px-3 py-2 hover:bg-white/70" href={navLink.href}>
            {navLink.label}
          </Link>
        ))}
        <Link className="rounded-full px-3 py-2 hover:bg-white/70" href="/login">
          Log in
        </Link>
        <Link
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 font-medium text-white"
          href="/signup"
        >
          Start free
        </Link>
      </nav>
    </header>
  );
}

export function PublicPageShell(props: PublicPageShellProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-5 py-6 md:px-8 md:py-8">
      <PublicHeader />
      <section className="grid gap-6 rounded-[2.5rem] border border-[var(--color-line)] bg-[rgba(255,255,255,0.52)] p-6 shadow-[var(--shadow-panel)] backdrop-blur md:grid-cols-[1.2fr_0.8fr] md:p-10">
        <div>
          <div className="inline-flex rounded-full border border-[var(--color-line)] bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.26em] text-[var(--color-muted)]">
            {props.eyebrow}
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            {props.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--color-muted)]">
            {props.description}
          </p>
        </div>

        <div className="rounded-[2rem] bg-[var(--color-sidebar)] p-6 text-[var(--color-sidebar-ink)] shadow-[var(--shadow-panel)]">
          <div className="text-xs uppercase tracking-[0.24em] text-[rgba(248,243,235,0.55)]">
            Public acquisition surface
          </div>
          <div className="mt-4 space-y-3 text-sm leading-7 text-[rgba(248,243,235,0.82)]">
            <p>
              This phase extends Roomflow beyond the operator dashboard with branded prospect pages,
              embedded forms, and portfolio-ready acquisition touchpoints.
            </p>
            <p>
              Every route here is intentionally public-safe, lightweight, and ready for deeper data wiring later.
            </p>
          </div>
          {props.ctaHref && props.ctaLabel ? (
            <Link
              className="mt-6 inline-flex rounded-full bg-[rgba(248,243,235,0.14)] px-5 py-3 font-medium text-white ring-1 ring-[rgba(248,243,235,0.18)]"
              href={props.ctaHref}
            >
              {props.ctaLabel}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{props.children}</section>
    </main>
  );
}

export function PublicCard(props: {
  title: string;
  children: React.ReactNode;
  accent?: "light" | "dark";
}) {
  const accentClassName =
    props.accent === "dark"
      ? "bg-[var(--color-sidebar)] text-[var(--color-sidebar-ink)] border-[rgba(248,243,235,0.12)]"
      : "bg-[var(--color-panel)] text-[var(--color-ink)] border-[var(--color-line)]";

  return (
    <article className={`rounded-[2rem] border p-6 shadow-[var(--shadow-panel)] ${accentClassName}`}>
      <h2 className="text-xl font-semibold tracking-tight">{props.title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 opacity-90">{props.children}</div>
    </article>
  );
}

export function PublicList(props: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {props.items.map((item) => (
        <li
          key={item}
          className="rounded-2xl border border-[var(--color-line)] bg-white/70 px-4 py-3"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
