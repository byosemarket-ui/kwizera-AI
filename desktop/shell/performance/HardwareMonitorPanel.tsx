import { useEffect, useState } from "react";
import { Activity, Cpu, HardDrive, Gauge, Zap } from "lucide-react";
import { workspacePerformanceEngine } from "./performance-engine";
import type { PerformanceSnapshot } from "./types";

export function HardwareMonitorPanel() {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(() => workspacePerformanceEngine.getSnapshot());

  useEffect(() => workspacePerformanceEngine.subscribe(setSnapshot), []);

  if (!snapshot) {
    return (
      <div className="perf-monitor-panel">
        <p className="floating-placeholder">Performance monitor is starting…</p>
      </div>
    );
  }

  const m = snapshot.metrics;
  return (
    <div className="perf-monitor-panel" data-perf-mode={snapshot.effectiveMode}>
      <div className="perf-monitor-header">
        <strong>Hardware Monitor</strong>
        <span className={`perf-badge mode-${snapshot.effectiveMode}`}>{snapshot.effectiveMode}</span>
      </div>
      <div className="perf-metric-grid">
        <Metric icon={<Gauge size={14} />} label="FPS" value={`${m.fps}`} hint={snapshot.responsiveness} />
        <Metric icon={<Cpu size={14} />} label="CPU" value={`${m.cpuUsage}%`} />
        <Metric icon={<Zap size={14} />} label="GPU" value={`${m.gpuUsage}%`} />
        <Metric icon={<Activity size={14} />} label="RAM" value={`${m.ramUsage}%`} hint={`${m.ramUsedMb} MB`} />
        <Metric icon={<HardDrive size={14} />} label="Disk" value={`${m.diskUsage}%`} hint={`${m.diskUsedGb}/${m.diskTotalGb || "—"} GB`} />
        <Metric icon={<Activity size={14} />} label="VRAM" value={`${m.vramUsage}%`} />
      </div>
      <div className="perf-monitor-footer">
        <span>Jobs {m.activeProductionTasks} · Models {m.activeAiModels}</span>
        <span>Cache {(snapshot.cache.totalBytes / 1024).toFixed(0)} KB</span>
      </div>
      {snapshot.alerts[0] && (
        <p className="perf-alert-line">{snapshot.alerts[0].message}</p>
      )}
      <p className="perf-recommend">{snapshot.recommendation}</p>
    </div>
  );
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="perf-metric">
      <span className="perf-metric-label">{icon}{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}
