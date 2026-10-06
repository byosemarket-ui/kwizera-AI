import type { LucideIcon } from "lucide-react";
import {
  Activity, BarChart3, BookOpen, Brain, Globe, LayoutDashboard, LineChart,
  NotebookPen, Radar, Settings, Shield, Star, Waypoints, Zap, History,
} from "lucide-react";
import type { ForexNavIconId } from "./forex-routes";

const ICONS: Record<ForexNavIconId, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  globe: Globe,
  star: Star,
  candlestick: LineChart,
  activity: Activity,
  "book-open": BookOpen,
  radar: Radar,
  brain: Brain,
  zap: Zap,
  waypoints: Waypoints,
  notebook: NotebookPen,
  shield: Shield,
  "bar-chart": BarChart3,
  history: History,
  settings: Settings,
};

export function resolveForexIcon(id: ForexNavIconId): LucideIcon {
  return ICONS[id] ?? LayoutDashboard;
}
