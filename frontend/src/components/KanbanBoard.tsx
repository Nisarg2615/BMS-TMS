import React from "react";
import { closestCorners, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import type { Task } from "../types";

const STATUSES: Task["status"][] = ["To Do", "In Progress", "Review", "Completed"];

const ColumnDrop = React.memo(function ColumnDrop({
  status,
  children,
}: {
  status: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      className="column"
      ref={setNodeRef}
      style={isOver ? { outline: "2px solid rgba(59,130,246,0.35)" } : undefined}
    >
      {children}
    </div>
  );
});

const TaskDraggable = React.memo(function TaskDraggable({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.65 : 1,
    cursor: "grab",
    transition: "transform 120ms ease, opacity 120ms ease",
    willChange: "transform",
  };

  const prio = String(task.priority || "Medium");
  const prioClass = prio === "High" ? "prioHigh" : prio === "Low" ? "prioLow" : "prioMed";

  return (
    <div
      className="taskCard"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={() => onOpen(task.id)}
    >
      <div className="taskTitle">{task.title}</div>
      <div className="taskMeta">
        <span className={"prio " + prioClass}>{prio}</span>
        <span>{task.department}</span>
        {task.due_date ? <span>Due: {task.due_date.slice(0, 10)}</span> : null}
      </div>
      <div className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.3 }}>
        {task.description ? task.description.slice(0, 90) + (task.description.length > 90 ? "..." : "") : "—"}
      </div>
    </div>
  );
});

export default function KanbanBoard({
  tasks,
  onMoveTask,
  onOpenTask,
}: {
  tasks: Task[];
  onMoveTask: (taskId: string, newStatus: string) => Promise<void> | void;
  onOpenTask: (taskId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // reduces “jitter” on quick drags
    })
  );

  const byStatus = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of STATUSES) map.set(String(s), []);
    for (const t of tasks) {
      const s = String(t.status || "To Do");
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(t);
    }
    return map;
  }, [tasks]);

  function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;
    const current = String(task.status || "To Do");
    if (current === overId) return;
    // Do not block drag end on network latency; keep UI instant.
    Promise.resolve(onMoveTask(activeId, overId)).catch((err) => {
      // UI will revert on error in parent; here we just avoid unhandled promise rejections.
      console.error("Failed to move task:", err);
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="kanban">
        {STATUSES.map((status) => {
          const s = String(status);
          const colTasks = byStatus.get(s) || [];
          return (
            <ColumnDrop key={s} status={s}>
              <div className="columnHeader">
                <div className="columnTitle">{s}</div>
                <div className="countBubble">{colTasks.length}</div>
              </div>
              {colTasks.length === 0 ? <div className="dropHint">Drop tasks here</div> : null}
              {colTasks.map((t) => (
                <TaskDraggable key={t.id} task={t} onOpen={onOpenTask} />
              ))}
            </ColumnDrop>
          );
        })}
      </div>
    </DndContext>
  );
}

