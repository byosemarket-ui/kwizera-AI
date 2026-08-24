import type { ReactNode } from "react";
import { Bell, Bot, Sparkles } from "lucide-react";
import type { LiveProgressState, LiveStatusCard } from "../types";

export function InfoCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: ReactNode }) {
  return (
    <article className="dash-card dash-info-card">
      {icon && <span className="dash-card-icon">{icon}</span>}
      <div>
        <small>{label}</small>
        <b>{value}</b>
        <p>{detail}</p>
      </div>
    </article>
  );
}

export function StatCard({ label, value, trend }: { label: string; value: string | number; trend?: string }) {
  return (
    <article className="dash-card dash-stat-card">
      <small>{label}</small>
      <b>{value}</b>
      {trend && <span className="dash-trend">{trend}</span>}
    </article>
  );
}

export function ProgressCard({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  return (
    <article className="dash-card dash-progress-card">
      <div className="dash-progress-head">
        <small>{label}</small>
        <b>{percent}%</b>
      </div>
      <div className="dash-progress-bar"><i style={{ width: `${percent}%` }} /></div>
      <p>{detail}</p>
    </article>
  );
}

export function CircularProgress({ percent, label }: { percent: number; label: string }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="dash-circular" aria-label={`${label} ${percent}%`}>
      <svg viewBox="0 0 72 72" width="72" height="72">
        <circle cx="36" cy="36" r={r} className="dash-circular-track" />
        <circle
          cx="36" cy="36" r={r}
          className="dash-circular-fill"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span><b>{percent}%</b><small>{label}</small></span>
    </div>
  );
}

export function AICard({ title, body, ready }: { title: string; body: string; ready?: boolean }) {
  return (
    <article className={`dash-card dash-ai-card ${ready ? "ready" : ""}`}>
      <Sparkles size={18} />
      <div>
        <b>{title}</b>
        <p>{body}</p>
      </div>
    </article>
  );
}

export function PreviewCard({ title, detail, meta }: { title: string; detail: string; meta?: string }) {
  return (
    <article className="dash-card dash-preview-card">
      <div className="dash-preview-thumb" />
      <div>
        <b>{title}</b>
        <p>{detail}</p>
        {meta && <small>{meta}</small>}
      </div>
    </article>
  );
}

export function NotificationCard({ title, detail, tone = "info" }: { title: string; detail: string; tone?: string }) {
  return (
    <article className={`dash-card dash-notification-card tone-${tone}`}>
      <Bell size={14} />
      <div><b>{title}</b><p>{detail}</p></div>
    </article>
  );
}

export function ActionCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="dash-card dash-action-card" onClick={onClick}>
      <Bot size={14} />
      <span>{label}</span>
    </button>
  );
}

export function LiveStatusRow({ cards }: { cards: LiveStatusCard[] }) {
  return (
    <div className="dash-live-row">
      {cards.map((card) => (
        <article key={card.key} className={`dash-live-card ${card.online ? "online" : ""}`}>
          <header>
            <span className={card.online ? "live-dot" : ""} />
            <small>{card.label}</small>
            <b>{card.value}</b>
          </header>
          <p>{card.detail}</p>
          {card.progress !== undefined && (
            <div className="dash-progress-bar slim"><i style={{ width: `${card.progress}%` }} /></div>
          )}
        </article>
      ))}
    </div>
  );
}

export function LiveProgressPanel({ progress }: { progress: LiveProgressState }) {
  return (
    <div className="dash-live-progress">
      <div className="dash-live-progress-summary">
        <CircularProgress percent={progress.percent} label="Overall" />
        <div>
          <StatCard label="Completed" value={progress.completed} />
          <StatCard label="Running" value={progress.running} />
          <StatCard label="Waiting" value={progress.waiting} />
          <p className="dash-remaining">{progress.remainingLabel}</p>
        </div>
      </div>
      <ul className="dash-task-list">
        {progress.tasks.map((task) => (
          <li key={task.id} className={`task-${task.status}`}>
            <span>{task.label}</span>
            <div className="dash-progress-bar slim"><i style={{ width: `${task.progress}%` }} /></div>
            <em>{task.status}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
