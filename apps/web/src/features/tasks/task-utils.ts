import type { Task, TaskInput } from "./types.ts";

export function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDateOnly(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}
export function validateTask(input: TaskInput) {
  const errors: Record<string, string> = {};
  if (!input.title.trim() || [...input.title.trim()].length > 200)
    errors.title = "Use um título de 1 a 200 caracteres.";
  else if (!/^\P{Cc}+$/u.test(input.title))
    errors.title = "Use um título em uma única linha.";
  if (input.description && [...input.description.trim()].length > 5000)
    errors.description = "A descrição deve ter até 5000 caracteres.";
  else if (input.description && !/^[\P{Cc}\t\r\n]*$/u.test(input.description))
    errors.description = "Remova os caracteres de controle da descrição.";
  if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(input.priority))
    errors.priority = "Escolha uma prioridade válida.";
  if (input.dueAt && !validDateOnly(input.dueAt))
    errors.dueAt = "Informe uma data de prazo válida.";
  return errors;
}
export function columnTasks(tasks: Task[], columnId: string) {
  return tasks
    .filter((task) => task.columnId === columnId)
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}
// Cópia imutável para a previsão visual. O servidor valida e devolve a ordem final.
export function moveTaskLocally(
  tasks: Task[],
  id: string,
  columnId: string,
  position: number,
): Task[] {
  const task = tasks.find((item) => item.id === id);
  if (!task) return tasks;
  const source = columnTasks(tasks, task.columnId).filter(
    (item) => item.id !== id,
  );
  const target =
    columnId === task.columnId ? source : columnTasks(tasks, columnId);
  if (!Number.isInteger(position) || position < 0 || position > target.length)
    return tasks;
  target.splice(position, 0, { ...task, columnId });
  const orders = new Map<string, Task>();
  if (columnId !== task.columnId)
    source.forEach((item, index) =>
      orders.set(item.id, { ...item, position: index }),
    );
  target.forEach((item, index) =>
    orders.set(item.id, { ...item, position: index }),
  );
  return tasks.map((item) => orders.get(item.id) ?? item);
}
export function removeTaskLocally(tasks: Task[], task: Task) {
  const remaining = tasks.filter((item) => item.id !== task.id);
  const positions = new Map(
    columnTasks(remaining, task.columnId).map((item, index) => [
      item.id,
      index,
    ]),
  );
  return remaining.map((item) =>
    positions.has(item.id)
      ? { ...item, position: positions.get(item.id)! }
      : item,
  );
}
export function dueLabel(dueAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(new Date(dueAt));
}
export function isOverdue(
  task: Task,
  completed: boolean,
  today = localDateString(),
) {
  return !completed && !!task.dueAt && task.dueAt.slice(0, 10) < today;
}
