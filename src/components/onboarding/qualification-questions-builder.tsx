"use client";

import { useState } from "react";
import {
  createEmptyWorkflow4CustomQuestionDraft,
  getWorkflow4QuestionTypeLabel,
  summarizeWorkflow4Drafts,
  type Workflow4QuestionDraft,
  type Workflow4QuestionDraftStatus,
  type Workflow4QuestionType,
} from "@/lib/workflow4-questions";

type QualificationQuestionsBuilderProps = {
  drafts: Workflow4QuestionDraft[];
  propertyName: string;
};

export function QualificationQuestionsBuilder({
  drafts,
  propertyName,
}: QualificationQuestionsBuilderProps) {
  const [questionDrafts, setQuestionDrafts] = useState<Workflow4QuestionDraft[]>(() =>
    drafts.length > 0 ? drafts : [createEmptyWorkflow4CustomQuestionDraft(0)],
  );
  const {
    activeDraftCount,
    hasTooManyRequiredQuestions,
    recommendedRequiredQuestionLimit,
    requiredDraftCount,
  } = summarizeWorkflow4Drafts(questionDrafts);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-[linear-gradient(135deg,rgba(184,88,51,0.1),rgba(255,247,240,0.85))] p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Guided intake design
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Choose the questions that keep {propertyName} practical to qualify
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            Keep this focused on fit, logistics, and shared-living expectations. You are shaping a lightweight screening flow, not a full rental application.
          </p>
        </section>

        {activeDraftCount === 0 ? (
          <div className="rounded-2xl border border-[rgba(184,88,51,0.25)] bg-[rgba(184,88,51,0.08)] px-4 py-3 text-sm text-[var(--color-accent-strong)]" role="alert">
            This intake is still empty. Turn on at least one question so Roomflow has something real to screen against.
          </div>
        ) : null}

        {hasTooManyRequiredQuestions ? (
          <div className="rounded-2xl border border-[rgba(37,99,235,0.18)] bg-[rgba(37,99,235,0.08)] px-4 py-3 text-sm text-slate-700">
            {requiredDraftCount} questions are marked required. Roomflow usually works best when {recommendedRequiredQuestionLimit} or fewer are mandatory.
          </div>
        ) : null}

        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Intake questions
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Set what is required, optional, or off
              </h2>
            </div>
            <button
              className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
              onClick={() => {
                setQuestionDrafts((currentDrafts) => [
                  ...currentDrafts,
                  createEmptyWorkflow4CustomQuestionDraft(currentDrafts.length),
                ]);
              }}
              type="button"
            >
              Add question
            </button>
          </div>

          <input name="questionCount" type="hidden" value={questionDrafts.length} />

          <div className="mt-4 space-y-4">
            {questionDrafts.map((draft, index) => {
              const isActive = draft.status !== "off";

              return (
                <article
                  className="overflow-hidden rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)]"
                  key={draft.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        {draft.suggested ? (
                          <span className="rounded-full bg-[rgba(184,88,51,0.12)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-accent-strong)]">
                            Suggested
                          </span>
                        ) : null}
                        {draft.isCustom ? (
                          <span className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
                            Custom
                          </span>
                        ) : null}
                        <span className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
                          {getWorkflow4QuestionTypeLabel(draft.type)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold">Question {index + 1}</h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
                        {draft.rationale || "Use this only if it genuinely helps confirm fit or next steps."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() => {
                          if (index === 0) {
                            return;
                          }

                          setQuestionDrafts((currentDrafts) => {
                            const nextDrafts = [...currentDrafts];
                            [nextDrafts[index - 1], nextDrafts[index]] = [
                              nextDrafts[index],
                              nextDrafts[index - 1],
                            ];
                            return nextDrafts;
                          });
                        }}
                        type="button"
                      >
                        Move up
                      </button>
                      <button
                        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] disabled:opacity-40"
                        disabled={index === questionDrafts.length - 1}
                        onClick={() => {
                          if (index === questionDrafts.length - 1) {
                            return;
                          }

                          setQuestionDrafts((currentDrafts) => {
                            const nextDrafts = [...currentDrafts];
                            [nextDrafts[index], nextDrafts[index + 1]] = [
                              nextDrafts[index + 1],
                              nextDrafts[index],
                            ];
                            return nextDrafts;
                          });
                        }}
                        type="button"
                      >
                        Move down
                      </button>
                      <button
                        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)]"
                        onClick={() => {
                          setQuestionDrafts((currentDrafts) =>
                            currentDrafts.filter((_, draftIndex) => draftIndex !== index),
                          );
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[var(--color-line)] px-5 py-5">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]">
                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--color-ink)]">
                          Question wording
                        </span>
                        <input
                          className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                          name={`questionLabel-${index}`}
                          onChange={(event) => {
                            const nextLabel = event.target.value;

                            setQuestionDrafts((currentDrafts) =>
                              currentDrafts.map((currentDraft, draftIndex) => {
                                if (draftIndex !== index) {
                                  return currentDraft;
                                }

                                return {
                                  ...currentDraft,
                                  fieldKey:
                                    currentDraft.isCustom && currentDraft.label.trim().length === 0
                                      ? normalizeClientFieldKey(nextLabel, draftIndex)
                                      : currentDraft.fieldKey,
                                  label: nextLabel,
                                };
                              }),
                            );
                          }}
                          placeholder="Ask only what you need to know"
                          type="text"
                          value={draft.label}
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--color-ink)]">
                          Question type
                        </span>
                        <select
                          className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                          name={`questionType-${index}`}
                          onChange={(event) => {
                            const nextType = event.target.value as Workflow4QuestionType;

                            setQuestionDrafts((currentDrafts) =>
                              currentDrafts.map((currentDraft, draftIndex) => {
                                if (draftIndex !== index) {
                                  return currentDraft;
                                }

                                return {
                                  ...currentDraft,
                                  options:
                                    nextType === "SELECT"
                                      ? currentDraft.options
                                      : [],
                                  type: nextType,
                                };
                              }),
                            );
                          }}
                          value={draft.type}
                        >
                          <option value="TEXT">Short text</option>
                          <option value="SELECT">Select</option>
                          <option value="YES_NO">Yes or no</option>
                          <option value="NUMBER">Number</option>
                          <option value="DATE">Date</option>
                        </select>
                      </label>
                    </div>

                    <fieldset className="mt-5">
                      <legend className="text-sm font-semibold text-[var(--color-ink)]">
                        How should Roomflow treat this question?
                      </legend>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {statusOptions.map((statusOption) => (
                          <label className="block cursor-pointer" key={statusOption.value}>
                            <input
                              checked={draft.status === statusOption.value}
                              className="peer sr-only"
                              name={`questionStatus-${index}`}
                              onChange={() => {
                                setQuestionDrafts((currentDrafts) =>
                                  currentDrafts.map((currentDraft, draftIndex) =>
                                    draftIndex === index
                                      ? { ...currentDraft, status: statusOption.value }
                                      : currentDraft,
                                  ),
                                );
                              }}
                              type="radio"
                              value={statusOption.value}
                            />
                            <span className="flex h-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-4 transition peer-checked:border-[var(--color-accent)] peer-checked:bg-[rgba(184,88,51,0.08)]">
                              <span>
                                <span className="block text-sm font-semibold text-[var(--color-ink)]">
                                  {statusOption.label}
                                </span>
                                <span className="mt-2 block text-sm leading-6 text-[var(--color-muted)]">
                                  {statusOption.description}
                                </span>
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <label className="mt-5 block">
                      <span className="text-sm font-semibold text-[var(--color-ink)]">
                        Helper text for operators
                      </span>
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                        name={`questionHelperText-${index}`}
                        onChange={(event) => {
                          const nextHelperText = event.target.value;

                          setQuestionDrafts((currentDrafts) =>
                            currentDrafts.map((currentDraft, draftIndex) =>
                              draftIndex === index
                                ? { ...currentDraft, helperText: nextHelperText }
                                : currentDraft,
                            ),
                          );
                        }}
                        value={draft.helperText}
                      />
                    </label>

                    {draft.type === "SELECT" ? (
                      <label className="mt-5 block">
                        <span className="text-sm font-semibold text-[var(--color-ink)]">
                          Select options
                        </span>
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]"
                          name={`questionOptions-${index}`}
                          onChange={(event) => {
                            const nextOptions = event.target.value
                              .split("\n")
                              .map((option) => option.trim())
                              .filter((option) => option.length > 0);

                            setQuestionDrafts((currentDrafts) =>
                              currentDrafts.map((currentDraft, draftIndex) =>
                                draftIndex === index
                                  ? { ...currentDraft, options: nextOptions }
                                  : currentDraft,
                              ),
                            );
                          }}
                          placeholder="One option per line"
                          value={draft.options.join("\n")}
                        />
                      </label>
                    ) : (
                      <input name={`questionOptions-${index}`} type="hidden" value="" />
                    )}

                    <div className="mt-5 rounded-2xl border border-dashed border-[var(--color-line)] bg-white px-4 py-4 text-sm text-[var(--color-muted)]">
                      {draft.helperText || "Keep this focused on fit, logistics, or shared-living expectations."}
                    </div>

                    <input name={`questionFieldKey-${index}`} type="hidden" value={draft.fieldKey} />
                    <input name={`questionIsCustom-${index}`} type="hidden" value={draft.isCustom ? "1" : "0"} />
                    <input name={`questionRationale-${index}`} type="hidden" value={draft.rationale} />
                    <input name={`questionSuggested-${index}`} type="hidden" value={draft.suggested ? "1" : "0"} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-white p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Preview
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            What leads will see first
          </h2>
          <div className="mt-4 space-y-3">
            {questionDrafts.filter((draft) => draft.status !== "off").length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-5 text-sm text-[var(--color-muted)]">
                Turn on a question to preview the live intake order.
              </div>
            ) : (
              questionDrafts
                .filter((draft) => draft.status !== "off")
                .map((draft, index) => (
                  <div
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-4"
                    key={`${draft.id}-preview`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--color-ink)]">
                        {index + 1}. {draft.label || "Untitled question"}
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
                        {draft.status}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      {getWorkflow4QuestionTypeLabel(draft.type)}
                    </div>
                  </div>
                ))
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-panel-strong)] p-5 text-sm leading-7 text-[var(--color-muted)]">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Safety note
          </div>
          <p className="mt-2">
            Stick to fit, logistics, and household expectations. Avoid sensitive personal screening questions that are unrelated to living compatibility or next-step coordination.
          </p>
        </section>
      </aside>
    </div>
  );
}

const statusOptions: Array<{
  description: string;
  label: string;
  value: Workflow4QuestionDraftStatus;
}> = [
  {
    description: "Leads must answer this before Roomflow treats qualification as complete.",
    label: "Required",
    value: "required",
  },
  {
    description: "Helpful context for your team, but not a hard blocker.",
    label: "Optional",
    value: "optional",
  },
  {
    description: "Keep it out of the live intake for now without losing the draft.",
    label: "Off",
    value: "off",
  },
];

function normalizeClientFieldKey(label: string, index: number) {
  const normalizedFieldKey =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+(.)/g, (_, group: string) => group.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, "")
      .replace(/^[A-Z]/, (letter) => letter.toLowerCase()) || `customQuestion${index + 1}`;

  return normalizedFieldKey;
}