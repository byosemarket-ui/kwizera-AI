import type { UndoCommand } from "./types";

const MAX_LEVELS = 40;

export class CommandStack {
  private undoStack: UndoCommand[] = [];
  private redoStack: UndoCommand[] = [];
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  execute(command: Omit<UndoCommand, "id" | "at"> & { id?: string }): UndoCommand {
    const entry: UndoCommand = {
      id: command.id ?? `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      label: command.label,
      at: new Date().toISOString(),
      undo: command.undo,
      redo: command.redo,
    };
    entry.redo();
    this.undoStack = [entry, ...this.undoStack].slice(0, MAX_LEVELS);
    this.redoStack = [];
    this.emit();
    return entry;
  }

  /** Push an already-applied change onto the undo stack without re-running redo. */
  pushApplied(command: Omit<UndoCommand, "id" | "at"> & { id?: string }): UndoCommand {
    const entry: UndoCommand = {
      id: command.id ?? `cmd-${Date.now().toString(36)}`,
      label: command.label,
      at: new Date().toISOString(),
      undo: command.undo,
      redo: command.redo,
    };
    this.undoStack = [entry, ...this.undoStack].slice(0, MAX_LEVELS);
    this.redoStack = [];
    this.emit();
    return entry;
  }

  undo(): UndoCommand | null {
    const entry = this.undoStack[0];
    if (!entry) return null;
    entry.undo();
    this.undoStack = this.undoStack.slice(1);
    this.redoStack = [entry, ...this.redoStack].slice(0, MAX_LEVELS);
    this.emit();
    return entry;
  }

  redo(): UndoCommand | null {
    const entry = this.redoStack[0];
    if (!entry) return null;
    entry.redo();
    this.redoStack = this.redoStack.slice(1);
    this.undoStack = [entry, ...this.undoStack].slice(0, MAX_LEVELS);
    this.emit();
    return entry;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  depth(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length };
  }

  peekUndo(): UndoCommand | null {
    return this.undoStack[0] ?? null;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }
}

export const commandStack = new CommandStack();
