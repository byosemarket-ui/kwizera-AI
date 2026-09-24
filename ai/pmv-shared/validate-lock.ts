/**
 * Validate Product Identity Lock against current project assets.
 */

import type { ProductIdentityLock } from "./identity-lock-types.js";
import { PRODUCT_IDENTITY_LOCK_VERSION } from "./identity-lock-types.js";
import { computeAssetFingerprint } from "./build-lock.js";

export interface IdentityLockValidation {
  ok: boolean;
  stale: boolean;
  issues: string[];
}

export function validateIdentityLock(input: {
  lock: ProductIdentityLock | null;
  projectId: string;
  productAssetIds: string[];
  heroAssetId: string | null;
}): IdentityLockValidation {
  const { lock, projectId, productAssetIds, heroAssetId } = input;
  const issues: string[] = [];

  if (!lock) {
    return { ok: false, stale: false, issues: ["Product Identity Lock is missing."] };
  }
  if (lock.version !== PRODUCT_IDENTITY_LOCK_VERSION) {
    issues.push("Identity lock version is outdated. Re-analyze the product.");
  }
  if (lock.projectId !== projectId) {
    issues.push("Identity lock does not belong to this project.");
  }
  if (!heroAssetId) {
    issues.push("Hero image is required.");
  } else if (lock.heroAssetId !== heroAssetId) {
    issues.push("Hero image changed since the lock was created.");
  }
  if (!productAssetIds.length) {
    issues.push("Product images are required.");
  }

  const assetSet = new Set(productAssetIds);
  if (lock.heroAssetId && !assetSet.has(lock.heroAssetId)) {
    issues.push("Locked hero image is no longer a project asset.");
  }
  for (const id of lock.productAssetIds) {
    if (!assetSet.has(id)) {
      issues.push("A locked product image was removed or replaced.");
      break;
    }
  }

  const fingerprint = computeAssetFingerprint(productAssetIds, heroAssetId);
  const stale = lock.assetFingerprint !== fingerprint
    || lock.status === "STALE"
    || issues.some((i) => /changed|removed|replaced|outdated/i.test(i));

  if (stale && !issues.length) {
    issues.push("Product images changed. Re-analyze to refresh the Product Identity Lock.");
  }

  if (lock.status === "INVALID") {
    issues.push("Identity lock is invalid.");
  }

  const requiredPresent = lock.protectedAttributes.length > 0
    && Array.isArray(lock.allowedCreativeChanges)
    && lock.allowedCreativeChanges.length > 0;
  if (!requiredPresent) {
    issues.push("Identity lock is missing protected or allowed-change definitions.");
  }

  const ok = lock.status === "LOCKED" && !stale && issues.length === 0;
  return { ok, stale, issues };
}

export function isLockReadyForCreative(lock: ProductIdentityLock | null, validation: IdentityLockValidation): boolean {
  return Boolean(lock && lock.status === "LOCKED" && validation.ok && !validation.stale);
}
