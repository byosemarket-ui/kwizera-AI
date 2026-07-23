import fs from "node:fs";
import { ResourceUsage } from "./types.js";

export class ResourceMonitor {
  measure(storageRoot: string): ResourceUsage {
    const mem = process.memoryUsage();
    const memoryUsageMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
    const memoryPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

    let diskUsageMb = 0;
    let diskFreeMb = 0;
    try {
      if (fs.existsSync(storageRoot)) {
        diskUsageMb = this.estimateDirectorySize(storageRoot);
      }
      diskFreeMb = 1024 * 1024;
    } catch {
      diskFreeMb = 0;
    }

    return {
      memoryUsageMb,
      memoryPercent: Math.min(100, memoryPercent),
      cpuUsagePercent: 0,
      diskUsageMb,
      diskFreeMb,
    };
  }

  private estimateDirectorySize(dir: string, depth = 0): number {
    if (depth > 3) return 0;
    let total = 0;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isFile()) {
          total += fs.statSync(full).size;
        } else if (entry.isDirectory()) {
          total += this.estimateDirectorySize(full, depth + 1);
        }
      }
    } catch {
      // skip inaccessible paths
    }
    return Math.round(total / 1024 / 1024 * 100) / 100;
  }
}
