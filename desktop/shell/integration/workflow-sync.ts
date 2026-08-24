import type { WorkspaceEvent, WorkspaceEventType, WorkflowStep, WorkspaceModuleId } from "./types";

const PIPELINE: Array<{ id: string; event: WorkspaceEventType; dependsOn: WorkspaceEventType[]; module: WorkspaceModuleId }> = [
  { id: "load", event: "project.loaded", dependsOn: [], module: "workspace" },
  { id: "images", event: "images.imported", dependsOn: ["project.loaded"], module: "workspace" },
  { id: "analysis", event: "product-analysis.completed", dependsOn: ["images.imported"], module: "product-analysis" },
  { id: "marketing", event: "marketing.completed", dependsOn: ["product-analysis.completed"], module: "marketing" },
  { id: "storyboard", event: "storyboard.completed", dependsOn: ["marketing.completed"], module: "storytelling" },
  { id: "image-gen", event: "image-generation.completed", dependsOn: ["storyboard.completed"], module: "image" },
  { id: "audio-gen", event: "audio-generation.completed", dependsOn: ["storyboard.completed"], module: "audio" },
  { id: "video-gen", event: "video-generation.completed", dependsOn: ["image-generation.completed", "audio-generation.completed"], module: "video" },
  { id: "render", event: "rendering.completed", dependsOn: ["video-generation.completed"], module: "rendering" },
  { id: "export", event: "export.completed", dependsOn: ["rendering.completed"], module: "output" },
];

export class WorkflowSynchronizer {
  private completed = new Set<WorkspaceEventType>();
  private failed = new Set<WorkspaceEventType>();
  private running = new Set<WorkspaceEventType>();

  reset(): void {
    this.completed.clear();
    this.failed.clear();
    this.running.clear();
  }

  observe(event: WorkspaceEvent): WorkflowStep[] {
    const type = event.type;
    if (type.endsWith(".started")) {
      const completedType = type.replace(/\.started$/, ".completed") as WorkspaceEventType;
      this.running.add(completedType);
    }
    // Pipeline milestones may be `.completed`, `.loaded`, `.imported`, etc.
    if (PIPELINE.some((s) => s.event === type) || type.endsWith(".completed")) {
      this.completed.add(type);
      this.running.delete(type);
      this.failed.delete(type);
    }
    if (type === "workflow.failed" || type === "module.error" || type === "error.propagated") {
      const related = String(event.payload.relatedEvent ?? "") as WorkspaceEventType;
      if (related) this.failed.add(related);
    }
    return this.snapshot();
  }

  snapshot(): WorkflowStep[] {
    return PIPELINE.map((step) => {
      const depsMet = step.dependsOn.every((d) => this.completed.has(d));
      const blocked = step.dependsOn.some((d) => this.failed.has(d));
      let status: WorkflowStep["status"] = "pending";
      if (this.completed.has(step.event)) status = "completed";
      else if (this.failed.has(step.event) || blocked) status = "failed";
      else if (this.running.has(step.event)) status = "running";
      else if (depsMet) status = "ready";
      else if (step.dependsOn.length) status = "blocked";
      return { ...step, status };
    });
  }

  /** Correct execution order: next ready steps that may start. */
  nextReady(): WorkflowStep[] {
    return this.snapshot().filter((s) => s.status === "ready");
  }

  canStart(event: WorkspaceEventType): boolean {
    const step = PIPELINE.find((s) => s.event === event || s.event.replace(".completed", ".started") === event);
    if (!step) return true;
    if (this.failed.has(step.event)) return false;
    return step.dependsOn.every((d) => this.completed.has(d));
  }

  summarize(): string {
    const steps = this.snapshot();
    const done = steps.filter((s) => s.status === "completed").length;
    const running = steps.filter((s) => s.status === "running").length;
    const blocked = steps.filter((s) => s.status === "blocked" || s.status === "failed").length;
    return `${done}/${steps.length} steps complete · ${running} running · ${blocked} blocked/failed`;
  }
}
