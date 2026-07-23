export class TaskScheduler {
    schedule(executionOrder, tasks) {
        const taskMap = new Map(tasks.map((t) => [t.id, t]));
        const scheduled = [];
        for (const id of executionOrder) {
            const task = taskMap.get(id);
            if (task) {
                scheduled.push(task);
            }
        }
        for (const task of tasks) {
            if (!scheduled.find((t) => t.id === task.id)) {
                scheduled.push(task);
            }
        }
        return scheduled;
    }
    getRemaining(completed, scheduled) {
        return scheduled.filter((t) => !completed.includes(t.id));
    }
}
//# sourceMappingURL=task-scheduler.js.map