import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, BookOpen, ChevronRight, Command, FileImage, FileVideo, FolderKanban, Package, Search, Sparkles,
} from "lucide-react";
import type { SearchCategory, SearchResult, WorkspaceId } from "../types";
import { useShell } from "../ShellContext";
import { navigationEngine } from "./navigation-engine";

const categoryIcons: Record<SearchCategory, typeof Search> = {
  projects: FolderKanban,
  products: Package,
  assets: Package,
  videos: FileVideo,
  images: FileImage,
  knowledge: BookOpen,
  reports: BarChart3,
  commands: Command,
  navigation: Sparkles,
};

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onSelectWorkspace: (workspace: WorkspaceId) => void;
}

export function GlobalSearch({ open, onClose, onSelectWorkspace }: GlobalSearchProps) {
  const { core, navigation, runQuickAction } = useShell();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) return navigationEngine.getSuggestions(navigation);
    return navigationEngine.search(query, {
      projectNames: core?.activeProject ? [core.activeProject] : ["Demo Product Project"],
    });
  }, [query, navigation, core?.activeProject]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const activate = (result: SearchResult) => {
    if (result.commandId === "save" || (result.commandId && !result.workspace && result.category === "commands")) {
      runQuickAction(result.commandId as Parameters<typeof runQuickAction>[0]);
    } else if (result.commandId && result.category === "commands") {
      runQuickAction(result.commandId as Parameters<typeof runQuickAction>[0]);
    } else if (result.workspace) {
      onSelectWorkspace(result.workspace);
    }
    onClose();
  };

  return (
    <div className="search-overlay nav-global-search" onMouseDown={onClose} role="dialog" aria-label="Global search">
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-input-row">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                activate(results[activeIndex]);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search projects, products, assets, knowledge, commands…"
          />
          <kbd>ESC</kbd>
        </div>
        <span className="search-section-label">{query.trim() ? "RESULTS" : "SUGGESTIONS"}</span>
        <div className="search-results" role="listbox">
          {results.length === 0 && <p className="search-empty">No matches. Try a workspace, project, or command.</p>}
          {results.map((result, index) => {
            const Icon = categoryIcons[result.category] ?? Search;
            return (
              <button
                key={result.id}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? "active" : ""}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => activate(result)}
              >
                <Icon size={17} />
                <span className="search-result-text">
                  <b>{result.label}</b>
                  <small>{result.detail}</small>
                </span>
                <em className="search-category">{result.category}</em>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
