import type { PreferenceProfilePackage } from "../../desktop-polish/types";
import type { DesktopPreferences } from "../../desktop-polish/types";
import { defaultPreferences } from "../../desktop-polish/preference-defaults";
import { validateAndRepairPreferences } from "../../desktop-polish/preference-validation";
import type { NavigationState } from "../types";
import { isWorkspaceId } from "../workspace-registry";
import type { ProfileImportResult } from "./types";

const CUSTOM_PROFILES_KEY = "kwizera.preference-profiles.v1";

function checksum(payload: unknown): string {
  const text = JSON.stringify(payload);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

export function exportPreferenceProfile(
  label: string,
  preferences: DesktopPreferences,
  navigation?: Pick<NavigationState, "favorites" | "pinned" | "collapsedGroups" | "quickAccess">,
  layoutId?: string | null,
): PreferenceProfilePackage {
  const base = {
    version: 1 as const,
    kind: "kwizera-preference-profile" as const,
    exportedAt: new Date().toISOString(),
    label: label.trim() || "Custom Profile",
    preferences: validateAndRepairPreferences(preferences).preferences,
    navigation: navigation
      ? {
          favorites: navigation.favorites,
          pinned: navigation.pinned,
          collapsedGroups: navigation.collapsedGroups,
          quickAccess: navigation.quickAccess,
        }
      : undefined,
    layoutId: layoutId ?? preferences.defaultLayoutId,
  };
  return { ...base, checksum: checksum(base) };
}

export function parsePreferenceProfile(raw: unknown): ProfileImportResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, confirmed: false, package: null, errors: ["Profile is not an object"], explanation: "Import failed." };
  }
  const pkg = raw as Partial<PreferenceProfilePackage>;
  const errors: string[] = [];
  if (pkg.version !== 1) errors.push("Unsupported profile version");
  if (pkg.kind !== "kwizera-preference-profile") errors.push("Not a KWIZERA preference profile");
  if (!pkg.label) errors.push("Missing profile label");
  if (!pkg.preferences) errors.push("Missing preferences payload");
  if (!pkg.checksum) errors.push("Missing checksum");

  if (errors.length) {
    return { ok: false, confirmed: false, package: null, errors, explanation: "Profile rejected." };
  }

  const { checksum: stored, ...rest } = pkg as PreferenceProfilePackage;
  if (checksum(rest) !== stored) {
    return {
      ok: false,
      confirmed: false,
      package: null,
      errors: ["Checksum mismatch — profile may be corrupted"],
      explanation: "Corrupt preference profile rejected.",
    };
  }

  const repaired = validateAndRepairPreferences(pkg.preferences);
  const normalized: PreferenceProfilePackage = {
    ...(pkg as PreferenceProfilePackage),
    preferences: repaired.preferences,
  };

  return {
    ok: true,
    confirmed: false,
    package: normalized,
    errors: [],
    explanation: `Profile “${normalized.label}” is valid and ready to import (confirmation required).`,
  };
}

/** Import only after explicit user confirmation — never silent overwrite. */
export function applyPreferenceProfile(
  pkg: PreferenceProfilePackage,
  confirmed: boolean,
): ProfileImportResult {
  if (!confirmed) {
    return {
      ok: false,
      confirmed: false,
      package: pkg,
      errors: ["Confirmation required before overwriting preferences"],
      explanation: "Import cancelled — preferences were not changed.",
    };
  }
  const parsed = parsePreferenceProfile(pkg);
  if (!parsed.ok || !parsed.package) return parsed;
  return {
    ok: true,
    confirmed: true,
    package: parsed.package,
    errors: [],
    explanation: `Imported preference profile “${parsed.package.label}”.`,
  };
}

export function mergeNavigationFromProfile(
  current: NavigationState,
  pkg: PreferenceProfilePackage,
): NavigationState {
  const nav = pkg.navigation;
  if (!nav) return current;
  return {
    ...current,
    favorites: (nav.favorites ?? current.favorites).filter(isWorkspaceId),
    pinned: nav.pinned ?? current.pinned,
    collapsedGroups: (nav.collapsedGroups as NavigationState["collapsedGroups"]) ?? current.collapsedGroups,
    quickAccess: (nav.quickAccess ?? current.quickAccess).filter(isWorkspaceId),
  };
}

export function saveCustomProfileBackup(pkg: PreferenceProfilePackage): void {
  try {
    const list = loadCustomProfileBackups();
    const next = [pkg, ...list.filter((p) => p.label !== pkg.label)].slice(0, 10);
    localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function loadCustomProfileBackups(): PreferenceProfilePackage[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_PROFILES_KEY) ?? "[]") as PreferenceProfilePackage[];
    return Array.isArray(raw) ? raw.filter((p) => parsePreferenceProfile(p).ok) : [];
  } catch {
    return [];
  }
}

export function createBackupProfile(preferences: DesktopPreferences, navigation: NavigationState): PreferenceProfilePackage {
  return exportPreferenceProfile(
    `Backup ${new Date().toLocaleString()}`,
    preferences ?? defaultPreferences,
    {
      favorites: navigation.favorites,
      pinned: navigation.pinned,
      collapsedGroups: navigation.collapsedGroups,
      quickAccess: navigation.quickAccess,
    },
    preferences.defaultLayoutId,
  );
}
