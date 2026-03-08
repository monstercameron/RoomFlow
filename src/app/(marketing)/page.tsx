import Link from "next/link";

import { PublicHeader } from "@/components/public-site";

const valueProps = [
  "Fewer repeated qualification messages",
  "Cleaner lead status visibility",
  "Earlier rule mismatch detection",
  "Faster routing to tours or applications",
];

const workflow = [
  "Capture inquiry",
  "Ask missing questions",
  "Check property-specific rules",
  "Route to the next correct action",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 md:px-8 md:py-8">
      <PublicHeader />

      <section className="grid flex-1 items-center gap-8 py-12 md:grid-cols-[1.15fr_0.85fr] md:py-18">
        <div>
          <div className="inline-flex rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.5)] px-4 py-2 text-xs uppercase tracking-[0.28em] text-[var(--color-muted)]">
            Shared-housing qualification workflow
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
            Listing sites find attention. Roomflow sorts the inquiry mess that
            comes after.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-muted)]">
            Roomflow gives room-rental operators a focused workflow for intake,
            house-rule fit, lead routing, templates, and documented decisions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-[var(--color-accent)] px-6 py-3 font-medium text-white shadow-lg shadow-[rgba(184,88,51,0.25)]"
            >
              Start free
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-6 py-3 font-medium"
            >
              See the funnel
            </Link>
            <Link
              href="/features"
              className="rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.72)] px-6 py-3 font-medium"
            >
              Explore features
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] backdrop-blur">
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
              How it works
            </div>
            <div className="mt-4 space-y-3">
              {workflow.map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-sidebar)] text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div className="font-medium">{step}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-[var(--color-sidebar)] p-6 text-[var(--color-sidebar-ink)] shadow-[var(--shadow-panel)]">
            <div className="text-xs uppercase tracking-[0.24em] text-[rgba(248,243,235,0.55)]">
              Core outcomes
            </div>
            <div className="mt-4 grid gap-3">
              {valueProps.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[rgba(248,243,235,0.12)] bg-[rgba(248,243,235,0.06)] px-4 py-3"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 pb-8 md:grid-cols-3">
        <Link className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] backdrop-blur" href="/pricing">
          <div className="text-sm uppercase tracking-[0.22em] text-[var(--color-muted)]">Pricing</div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">Personal and Org packaging</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">Public packaging now mirrors the in-app plan model instead of leaving pricing implied.</p>
        </Link>
        <Link className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] backdrop-blur" href="/ai-tools">
          <div className="text-sm uppercase tracking-[0.22em] text-[var(--color-muted)]">AI funnels</div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">Outcome-specific landing pages</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">Acquisition surfaces now include dedicated tool pages for reply drafting, rule explanations, and follow-up planning.</p>
        </Link>
        <Link className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)] backdrop-blur" href="/capture/demo-workspace">
          <div className="text-sm uppercase tracking-[0.22em] text-[var(--color-muted)]">Public intake</div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">Branded external forms</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">Lead capture, embedded qualification, waitlist, status, and portal shells are now part of the public route map.</p>
        </Link>
      </section>
    </main>
  );
}
