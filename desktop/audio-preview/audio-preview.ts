/**
 * Shared Audio Library preview player — one HTMLAudioElement for the whole Studio,
 * streaming from the existing Audio Library playback route.
 */
import { useSyncExternalStore } from "react";

export type AudioPreviewStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface AudioPreviewState {
  assetId: string | null;
  status: AudioPreviewStatus;
  currentMs: number;
  durationMs: number;
}

const IDLE: AudioPreviewState = { assetId: null, status: "idle", currentMs: 0, durationMs: 0 };

export class AudioPreviewController {
  private el: HTMLAudioElement | null = null;
  private state: AudioPreviewState = IDLE;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getState = (): AudioPreviewState => this.state;

  private set(next: Partial<AudioPreviewState>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  /** Play, pause or resume `assetId`; switching items stops the previous one. */
  toggle(assetId: string, url: string): void {
    if (typeof Audio === "undefined" || !url) return;
    if (this.el && this.state.assetId === assetId) {
      if (this.state.status === "playing" || this.state.status === "loading") {
        this.el.pause();
        this.set({ status: "paused" });
      } else {
        this.set({ status: "loading" });
        void this.el.play().catch(() => this.set({ status: "error" }));
      }
      return;
    }
    this.stop();
    const el = new Audio(url);
    el.preload = "metadata";
    this.el = el;
    this.set({ assetId, status: "loading", currentMs: 0, durationMs: 0 });
    const mine = () => this.el === el;
    el.onloadedmetadata = () => {
      if (mine() && Number.isFinite(el.duration)) this.set({ durationMs: Math.round(el.duration * 1000) });
    };
    el.onplaying = () => { if (mine()) this.set({ status: "playing" }); };
    el.ontimeupdate = () => { if (mine()) this.set({ currentMs: Math.round(el.currentTime * 1000) }); };
    el.onended = () => { if (mine()) this.set({ status: "paused", currentMs: 0 }); };
    el.onerror = () => { if (mine()) this.set({ status: "error" }); };
    void el.play().catch(() => { if (mine()) this.set({ status: "error" }); });
  }

  stop(): void {
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute("src");
      this.el.load();
      this.el = null;
    }
    if (this.state.assetId) this.set(IDLE);
  }
}

export const audioPreview = new AudioPreviewController();

export function useAudioPreview(): AudioPreviewState {
  return useSyncExternalStore(audioPreview.subscribe, audioPreview.getState, audioPreview.getState);
}
