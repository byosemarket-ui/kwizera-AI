import type { ConnectorDefinition } from "../connector-management/types.js";
import type { PluginManifest, PluginRuntime } from "../plugin-management/types.js";
import type { ToolDefinition, ToolHandler } from "../tool-management/types.js";

/** Provider-neutral contracts for trusted future connector, plugin, tool, and workflow extension packages. */
export interface EnterpriseExtensionPackage {
  connector?: ConnectorDefinition;
  plugin?: { manifest: PluginManifest; factory: () => PluginRuntime };
  tool?: { definition: ToolDefinition; handler: ToolHandler };
  workflowExtension?: { id: string; version: string; requiredPermissions: string[]; };
}

export function defineEnterpriseExtension(extension: EnterpriseExtensionPackage): EnterpriseExtensionPackage {
  if (!extension.connector && !extension.plugin && !extension.tool && !extension.workflowExtension) throw new Error("An enterprise extension must provide at least one capability");
  return extension;
}