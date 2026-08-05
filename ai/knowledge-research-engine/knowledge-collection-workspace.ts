/**
 * Local Knowledge Workspace — domain-organized storage for collected learning resources.
 * Collection only; does not extract or transform knowledge.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";
import type { DownloadableResourceType, KnowledgeCollectionRepairResult } from "./types.js";
import { resolveDownloadFolder } from "./download-safety.js";

/** Shared resource-type folders under the workspace (and under each domain). */
export const WORKSPACE_TYPE_FOLDERS = [
  "official-docs",
  "pdf",
  "books",
  "manuals",
  "research",
  "examples",
  "api",
  "images",
  "markdown",
  "html",
  "json",
  "downloads",
  "metadata",
] as const;

/**
 * Domain workspace folders prepared for KWIZERA studio knowledge collection.
 * Keys are Knowledge Domain Planning IDs (or stable aliases).
 */
export const WORKSPACE_DOMAIN_FOLDERS: Record<string, string> = {
  "video-production-knowledge": "video-production",
  "camera-knowledge": "camera",
  "lighting-knowledge": "lighting",
  "marketing-knowledge": "marketing",
  "storytelling-knowledge": "storytelling",
  "animation-knowledge": "animation",
  "rendering-knowledge": "rendering",
  "video-editing-knowledge": "editing",
  "product-knowledge": "product-photography",
  "composition-knowledge": "product-photography",
  "social-media-knowledge": "social-media",
  "tiktok-knowledge": "social-media",
  "instagram-knowledge": "social-media",
  "facebook-knowledge": "social-media",
  "youtube-knowledge": "social-media",
  "audio-knowledge": "audio",
  "music-knowledge": "music",
  "branding-knowledge": "branding",
  "customer-psychology": "marketing",
  "sales-psychology": "marketing",
  "ecommerce-knowledge": "ecommerce",
  "ui-ux-knowledge": "ui-ux",
  "motion-graphics-knowledge": "animation",
  "scene-knowledge": "video-production",
  "camera-movement-knowledge": "camera",
  "business-knowledge": "business",
  "cta-knowledge": "marketing",
  "color-theory": "branding",
  typography: "branding",
  "voice-knowledge": "audio",
  "product-category-knowledge": "product-photography",
};

export const PREPARED_WORKSPACE_DOMAIN_SLUGS = [
  "video-production",
  "camera",
  "lighting",
  "marketing",
  "storytelling",
  "animation",
  "rendering",
  "editing",
  "product-photography",
  "social-media",
  "audio",
  "music",
  "branding",
  "ecommerce",
  "ui-ux",
  "business",
  "general",
] as const;

export function domainIdToWorkspaceSlug(domainId?: string | null): string {
  if (!domainId?.trim()) return "general";
  return WORKSPACE_DOMAIN_FOLDERS[domainId.trim()] ?? slugify(domainId);
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "general";
}

export class KnowledgeCollectionWorkspace {
  private root = "";

  async initialize(workspaceRoot: string): Promise<KnowledgeCollectionRepairResult> {
    this.root = workspaceRoot;
    await fs.mkdir(this.root, { recursive: true });
    return this.ensureStructure();
  }

  getRoot(): string {
    return this.root;
  }

  listDomainFolders(): string[] {
    return [...PREPARED_WORKSPACE_DOMAIN_SLUGS];
  }

  listTypeFolders(): string[] {
    return [...WORKSPACE_TYPE_FOLDERS];
  }

  resolveResourceDirectory(
    domainId: string | undefined,
    sourceType: KnowledgeAcquisitionSourceType,
    resourceType: DownloadableResourceType
  ): string {
    const typeFolder = resolveDownloadFolder(sourceType, resourceType);
    const enrichedType =
      resourceType === "markdown"
        ? "markdown"
        : resourceType === "html"
          ? "html"
          : resourceType === "json"
            ? "json"
            : typeFolder;
    if (!domainId?.trim()) {
      return path.join(this.root, enrichedType);
    }
    const domainSlug = domainIdToWorkspaceSlug(domainId);
    return path.join(this.root, domainSlug, enrichedType);
  }

  resolveResourcePath(
    domainId: string | undefined,
    sourceType: KnowledgeAcquisitionSourceType,
    resourceType: DownloadableResourceType,
    fileName: string
  ): string {
    return path.join(this.resolveResourceDirectory(domainId, sourceType, resourceType), fileName);
  }

  /** Creates missing folders and repairs workspace organization issues. */
  async ensureStructure(): Promise<KnowledgeCollectionRepairResult> {
    const actions: string[] = [];
    const remainingIssues: string[] = [];

    for (const folder of WORKSPACE_TYPE_FOLDERS) {
      const target = path.join(this.root, folder);
      await fs.mkdir(target, { recursive: true });
      actions.push(`Ensured type folder: ${folder}`);
    }

    for (const slug of PREPARED_WORKSPACE_DOMAIN_SLUGS) {
      const domainRoot = path.join(this.root, slug);
      await fs.mkdir(domainRoot, { recursive: true });
      for (const folder of WORKSPACE_TYPE_FOLDERS) {
        if (folder === "metadata") continue;
        await fs.mkdir(path.join(domainRoot, folder), { recursive: true });
      }
      actions.push(`Ensured domain workspace: ${slug}`);
    }

    await fs.mkdir(path.join(this.root, "metadata"), { recursive: true });

    try {
      await fs.access(this.root);
    } catch {
      remainingIssues.push("Workspace root is not accessible after repair.");
    }

    return {
      repaired: remainingIssues.length === 0,
      actions,
      remainingIssues,
    };
  }

  async audit(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    for (const slug of PREPARED_WORKSPACE_DOMAIN_SLUGS) {
      try {
        await fs.access(path.join(this.root, slug));
      } catch {
        issues.push(`Missing domain folder: ${slug}`);
      }
    }
    for (const folder of ["official-docs", "manuals", "research", "examples", "metadata"]) {
      try {
        await fs.access(path.join(this.root, folder));
      } catch {
        issues.push(`Missing type folder: ${folder}`);
      }
    }
    return { healthy: issues.length === 0, issues };
  }
}
