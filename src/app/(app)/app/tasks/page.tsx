import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getTasksViewData } from "@/lib/app-data";
import {
  createTaskAction,
  updateTaskStatusAction,
} from "@/lib/collaboration-actions";

export default async function TasksPage() {
  const tasksView = await getTasksViewData();

  return (
    <main>
      <PageHeader
        eyebrow="Tasks"
        title="Shared follow-up queue"
        description="Track operator work with due dates, explicit assignees, and quick status updates."
      />

      <section className="mb-6 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="text-xl font-semibold">Create task</div>
        <form action={createTaskAction} className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr_0.9fr_auto]">
          <label className="space-y-2 text-sm font-medium">
            <span>Title</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              name="title"
              placeholder="Call prospect back before tour handoff"
              required
              type="text"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Due</span>
            <input
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              name="dueAt"
              type="datetime-local"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Assign to</span>
            <select
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
              defaultValue="unassigned"
              name="assignedMembershipId"
            >
              {tasksView.teammateOptions.map((teammateOption) => (
                <option key={teammateOption.value} value={teammateOption.value}>
                  {teammateOption.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <input type="hidden" name="redirectTo" value="/app/tasks" />
            <button
              className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white"
              type="submit"
            >
              Save task
            </button>
          </div>
        </form>
      </section>

      <div className="space-y-3">
        {tasksView.tasks.length === 0 ? (
          <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] px-6 py-5 text-sm text-[var(--color-muted)] shadow-[var(--shadow-panel)]">
            No collaboration tasks yet.
          </div>
        ) : (
          tasksView.tasks.map((task) => (
            <div
              className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-[var(--shadow-panel)]"
              key={task.id}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-lg font-semibold">{task.title}</div>
                    <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs">
                      {task.status}
                    </span>
                    {task.isOverdue ? (
                      <span className="rounded-full border border-[rgba(184,88,51,0.28)] bg-[rgba(184,88,51,0.08)] px-3 py-1 text-xs text-[var(--color-accent-strong)]">
                        Overdue
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">
                    Assigned to {task.assignedTo} {task.dueAt !== "Not set" ? `| due ${task.dueAt}` : "| no due date"}
                  </div>
                  {task.leadId && task.leadName ? (
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      Lead: <Link className="font-medium text-[var(--color-accent-strong)]" href={`/app/leads/${task.leadId}`}>{task.leadName}</Link>
                    </div>
                  ) : null}
                  {task.propertyName ? (
                    <div className="mt-1 text-sm text-[var(--color-muted)]">
                      Property: {task.propertyName}
                    </div>
                  ) : null}
                </div>

                <form action={updateTaskStatusAction.bind(null, task.id)} className="flex flex-wrap items-end gap-3">
                  <label className="space-y-2 text-sm font-medium">
                    <span>Status</span>
                    <select
                      className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 outline-none"
                      defaultValue={task.statusValue}
                      name="status"
                    >
                      {tasksView.taskStatusOptions.map((taskStatusOption) => (
                        <option key={`${task.id}-${taskStatusOption.value}`} value={taskStatusOption.value}>
                          {taskStatusOption.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input type="hidden" name="redirectTo" value="/app/tasks" />
                  <button
                    className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm font-medium"
                    type="submit"
                  >
                    Update
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}