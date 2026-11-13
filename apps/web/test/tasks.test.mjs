import test from "node:test";
import assert from "node:assert/strict";
import {
  columnTasks,
  dueLabel,
  isOverdue,
  localDateString,
  moveTaskLocally,
  removeTaskLocally,
  validDateOnly,
  validateTask,
} from "../src/features/tasks/task-utils.ts";
const task = (id, columnId, position) => ({
  id,
  title: id,
  columnId,
  position,
  description: null,
  priority: "MEDIUM",
  dueAt: null,
  assignee: null,
  creator: { id: "creator", name: "Teste" },
  createdAt: "2026-11-13T00:00:00Z",
  updatedAt: "2026-11-13T00:00:00Z",
});
test("reordenação otimista é imutável e compacta origem/destino", () => {
  const tasks = [
    task("a", "todo", 0),
    task("b", "todo", 1),
    task("c", "doing", 0),
  ];
  const snapshot = structuredClone(tasks);
  const moved = moveTaskLocally(tasks, "a", "doing", 1);
  assert.deepEqual(tasks, snapshot);
  assert.deepEqual(
    columnTasks(moved, "todo").map((task) => [task.id, task.position]),
    [["b", 0]],
  );
  assert.deepEqual(
    columnTasks(moved, "doing").map((task) => [task.id, task.position]),
    [
      ["c", 0],
      ["a", 1],
    ],
  );
});
test("reordena na mesma coluna para cima e para baixo", () => {
  const tasks = [
    task("a", "todo", 0),
    task("b", "todo", 1),
    task("c", "todo", 2),
  ];
  const moved = moveTaskLocally(tasks, "c", "todo", 0);
  assert.deepEqual(
    columnTasks(moved, "todo").map((task) => task.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    columnTasks(moveTaskLocally(moved, "c", "todo", 2), "todo").map(
      (task) => task.id,
    ),
    ["a", "b", "c"],
  );
});
test("coluna vazia aceita posição zero e limites inválidos preservam snapshot", () => {
  const tasks = [task("a", "todo", 0)];
  assert.equal(moveTaskLocally(tasks, "a", "done", 0)[0].columnId, "done");
  for (const position of [-1, 1, 0.5])
    assert.equal(moveTaskLocally(tasks, "a", "done", position), tasks);
  assert.equal(moveTaskLocally(tasks, "missing", "done", 0), tasks);
});
test("exclusão compacta só a coluna afetada", () => {
  const tasks = [
    task("a", "todo", 0),
    task("b", "todo", 1),
    task("c", "doing", 0),
  ];
  const remaining = removeTaskLocally(tasks, tasks[0]);
  assert.deepEqual(
    remaining.map((task) => [task.id, task.position]),
    [
      ["b", 0],
      ["c", 0],
    ],
  );
  assert.equal(tasks.length, 3);
});
test("datas civis preservam dia e rejeitam datas impossíveis", () => {
  assert.equal(validDateOnly("2028-02-29"), true);
  for (const value of [
    "2026-02-30",
    "2026-13-01",
    "13/11/2026",
    "2026-11-13T00:00:00Z",
  ])
    assert.equal(validDateOnly(value), false);
  assert.equal(dueLabel("2026-11-13T00:00:00.000Z"), "13/11/2026");
  assert.equal(localDateString(new Date(2026, 10, 13, 23)), "2026-11-13");
});
test("atraso compara datas civis e não marca tarefas concluídas ou com prazo hoje", () => {
  const item = { ...task("a", "todo", 0), dueAt: "2026-11-12T00:00:00Z" };
  assert.equal(isOverdue(item, false, "2026-11-13"), true);
  assert.equal(isOverdue(item, true, "2026-11-13"), false);
  assert.equal(isOverdue(item, false, "2026-11-12"), false);
});
test("formulário valida título, descrição, prioridade e prazo sem apagar opcionais", () => {
  const input = {
    title: "Título real",
    description: null,
    priority: "MEDIUM",
    dueAt: null,
    assigneeId: null,
  };
  assert.deepEqual(validateTask(input), {});
  assert.deepEqual(
    Object.keys(
      validateTask({
        ...input,
        title: "",
        description: "x".repeat(5001),
        priority: "CRITICAL",
        dueAt: "2026-02-30",
      }),
    ),
    ["title", "description", "priority", "dueAt"],
  );
  assert.ok(validateTask({ ...input, title: "linha\nquebrada" }).title);
});
