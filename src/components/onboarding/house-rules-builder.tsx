"use client";

import { useState } from "react";
import {
  createEmptyWorkflow3CustomRuleDraft,
  type Workflow3CustomRuleDraft,
  type Workflow3RuleDraft,
  type Workflow3StructuredRuleKey,
  workflow3SeverityOptions,
  workflow3StructuredRuleDefinitions,
} from "@/lib/workflow3-house-rules-config";

type HouseRulesBuilderProps = {
  customRules: Workflow3CustomRuleDraft[];
  propertyName: string;
  ruleDrafts: Record<Workflow3StructuredRuleKey, Workflow3RuleDraft>;
};

type CustomRuleState = Workflow3CustomRuleDraft & {
  id: string;
};

export function HouseRulesBuilder({
  customRules,
  propertyName,
  ruleDrafts,
}: HouseRulesBuilderProps) {
  const [rules, setRules] = useState(ruleDrafts);
  const [customRuleState, setCustomRuleState] = useState<CustomRuleState[]>(() =>
    customRules.length > 0
      ? customRules.map((rule, index) => ({
          ...rule,
          id: `custom-${index}`,
        }))
      : [],
  );

  const activeStructuredRules = workflow3StructuredRuleDefinitions.filter(
    (definition) => rules[definition.key].enabled,
  );
  const completedCustomRules = customRuleState.filter(
    (rule) => rule.title.trim().length > 0 && rule.description.trim().length > 0,
  );
  const blockingCount =
    activeStructuredRules.filter(
      (definition) => rules[definition.key].severity === "blocking",
    ).length +
    completedCustomRules.filter((rule) => rule.severity === "blocking").length;
  const warningCount =
    activeStructuredRules.filter(
      (definition) => rules[definition.key].severity === "warning",
    ).length +
    completedCustomRules.filter((rule) => rule.severity === "warning").length;
  const informationalCount =
    activeStructuredRules.filter(
      (definition) => rules[definition.key].severity === "informational",
    ).length +
    completedCustomRules.filter((rule) => rule.severity === "informational").length;

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-[linear-gradient(135deg,rgba(184,88,51,0.08),rgba(255,255,255,0.92))] p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Guided fit setup
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Shape the screening tone for {propertyName}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
            Turn on only the expectations that matter for this house, choose the best matching setting, and decide whether each one should block, warn, or simply inform your team.
          </p>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Core house rules
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Pick the policies Roomflow should screen for first
              </h2>
            </div>
            <div className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-2 text-sm font-medium text-[var(--color-muted)]">
              {activeStructuredRules.length} active
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {workflow3StructuredRuleDefinitions.map((definition) => {
              const draft = rules[definition.key];

              return (
                <article
                  className="overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)]"
                  key={definition.key}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
                          {definition.categoryLabel}
                        </span>
                        {draft.suggested ? (
                          <span className="rounded-full bg-[rgba(184,88,51,0.12)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-accent-strong)]">
                            Suggested starter
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-xl font-semibold">{definition.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
                        {definition.description}
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink)]">
                      <input
                        checked={draft.enabled}
                        className="h-4 w-4"
                        name={`${definition.key}Enabled`}
                        onChange={(event) => {
                          setRules((currentRules) => ({
                            ...currentRules,
                            [definition.key]: {
                              ...currentRules[definition.key],
                              enabled: event.target.checked,
                            },
                          }));
                        }}
                        type="checkbox"
                        value="1"
                      />
                      Use this rule
                    </label>
                  </div>

                  <div className="border-t border-[var(--color-line)] px-5 py-5">
                    <fieldset disabled={!draft.enabled}>
                      <legend className="text-sm font-semibold text-[var(--color-ink)]">
                        Choose the house setting
                      </legend>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {definition.options.map((option) => (
                          <label className="block cursor-pointer" key={option.value}>
                            <input
                              checked={draft.selectedValue === option.value}
                              className="peer sr-only"
                              name={`${definition.key}Value`}
                              onChange={() => {
                                setRules((currentRules) => ({
                                  ...currentRules,
                                  [definition.key]: {
                                    ...currentRules[definition.key],
                                    selectedValue: option.value,
                                  },
                                }));
                              }}
                              type="radio"
                              value={option.value}
                            />
                            <span className="flex h-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4 transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[rgba(184,88,51,0.08)] disabled:opacity-60">
                              <span>
                                <span className="block text-sm font-semibold text-[var(--color-ink)]">
                                  {option.label}
                                </span>
                                <span className="mt-2 block text-sm leading-6 text-[var(--color-muted)]">
                                  {option.description}
                                </span>
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="mt-5" disabled={!draft.enabled}>
                      <legend className="text-sm font-semibold text-[var(--color-ink)]">
                        Decide how strongly this should affect qualification
                      </legend>
                      <div className="mt-4 grid gap-3">
                        {workflow3SeverityOptions.map((option) => (
                          <label className="block cursor-pointer" key={option.value}>
                            <input
                              checked={draft.severity === option.value}
                              className="peer sr-only"
                              name={`${definition.key}Severity`}
                              onChange={() => {
                                setRules((currentRules) => ({
                                  ...currentRules,
                                  [definition.key]: {
                                    ...currentRules[definition.key],
                                    severity: option.value,
                                  },
                                }));
                              }}
                              type="radio"
                              value={option.value}
                            />
                            <span className="flex rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4 transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[rgba(184,88,51,0.08)]">
                              <span>
                                <span className="block text-sm font-semibold text-[var(--color-ink)]">
                                  {option.label}
                                </span>
                                <span className="mt-2 block text-sm leading-6 text-[var(--color-muted)]">
                                  {option.description}
                                </span>
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Custom rules
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Capture anything unique about this home
              </h2>
            </div>
            <button
              className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
              onClick={() => {
                setCustomRuleState((currentRules) => [
                  ...currentRules,
                  {
                    ...createEmptyWorkflow3CustomRuleDraft(),
                    id: `custom-${currentRules.length}-${Date.now()}`,
                  },
                ]);
              }}
              type="button"
            >
              Add custom rule
            </button>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
            Examples: early-morning shift workers only, no musical instruments after 9pm, or a specific move-in coordination requirement.
          </p>

          <input name="customRuleCount" type="hidden" value={customRuleState.length} />

          {customRuleState.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--color-line)] bg-white px-4 py-5 text-sm text-[var(--color-muted)]">
              No custom rules yet. Add one only if the preset areas above miss something important.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {customRuleState.map((rule, index) => (
                <article
                  className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4"
                  key={rule.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Custom rule {index + 1}</div>
                    <button
                      className="text-sm font-medium text-[var(--color-accent-strong)]"
                      onClick={() => {
                        setCustomRuleState((currentRules) =>
                          currentRules.filter((currentRule) => currentRule.id !== rule.id),
                        );
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium">Rule title</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 outline-none"
                        name={`customTitle-${index}`}
                        onChange={(event) => {
                          setCustomRuleState((currentRules) =>
                            currentRules.map((currentRule) =>
                              currentRule.id === rule.id
                                ? { ...currentRule, title: event.target.value }
                                : currentRule,
                            ),
                          );
                        }}
                        placeholder="No parties after midnight"
                        type="text"
                        value={rule.title}
                      />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium">What should the team know?</span>
                      <textarea
                        className="min-h-28 w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-3 outline-none"
                        name={`customDescription-${index}`}
                        onChange={(event) => {
                          setCustomRuleState((currentRules) =>
                            currentRules.map((currentRule) =>
                              currentRule.id === rule.id
                                ? { ...currentRule, description: event.target.value }
                                : currentRule,
                            ),
                          );
                        }}
                        placeholder="Guests are fine for dinner, but large late-night gatherings create problems with the neighbors."
                        value={rule.description}
                      />
                    </label>
                  </div>

                  <fieldset className="mt-4">
                    <legend className="text-sm font-medium">Severity</legend>
                    <div className="mt-3 grid gap-3">
                      {workflow3SeverityOptions.map((option) => (
                        <label className="block cursor-pointer" key={`${rule.id}-${option.value}`}>
                          <input
                            checked={rule.severity === option.value}
                            className="peer sr-only"
                            name={`customSeverity-${index}`}
                            onChange={() => {
                              setCustomRuleState((currentRules) =>
                                currentRules.map((currentRule) =>
                                  currentRule.id === rule.id
                                    ? { ...currentRule, severity: option.value }
                                    : currentRule,
                                ),
                              );
                            }}
                            type="radio"
                            value={option.value}
                          />
                          <span className="flex rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4 transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[rgba(184,88,51,0.08)]">
                            <span>
                              <span className="block text-sm font-semibold text-[var(--color-ink)]">
                                {option.label}
                              </span>
                              <span className="mt-2 block text-sm leading-6 text-[var(--color-muted)]">
                                {option.description}
                              </span>
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5 shadow-[var(--shadow-panel)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Summary
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Qualification impact at a glance
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <SummaryStat label="Blocking" tone="bg-[rgba(184,88,51,0.12)] text-[var(--color-accent-strong)]" value={blockingCount} />
            <SummaryStat label="Warnings" tone="bg-[rgba(45,104,136,0.12)] text-[rgb(45,104,136)]" value={warningCount} />
            <SummaryStat label="Info" tone="bg-[rgba(51,92,57,0.12)] text-[rgb(51,92,57)]" value={informationalCount} />
          </div>

          <div className="mt-5 space-y-3">
            {activeStructuredRules.length === 0 && completedCustomRules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-line)] px-4 py-4 text-sm text-[var(--color-muted)]">
                Turn on at least one rule so Roomflow knows what to screen for.
              </div>
            ) : null}

            {activeStructuredRules.map((definition) => {
              const selectedOption = definition.options.find(
                (option) => option.value === rules[definition.key].selectedValue,
              );

              return (
                <div
                  className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4"
                  key={`summary-${definition.key}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{definition.title}</div>
                    <span className="rounded-full bg-[var(--color-panel-strong)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      {rules[definition.key].severity}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    {selectedOption?.label ?? "Not selected"}
                  </div>
                </div>
              );
            })}

            {completedCustomRules.map((rule, index) => (
              <div
                className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4"
                key={`custom-summary-${index}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{rule.title}</div>
                  <span className="rounded-full bg-[var(--color-panel-strong)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
                    {rule.severity}
                  </span>
                </div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  {rule.description}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-white p-5">
          <div className="text-sm font-semibold">What happens next</div>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            After saving, Roomflow prepares a starter qualification question set based on these rules so you can review questions before turning on channels.
          </p>
        </section>
      </aside>
    </div>
  );
}

function SummaryStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4">
      <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${tone}`}>
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
        {value}
      </div>
    </div>
  );
}