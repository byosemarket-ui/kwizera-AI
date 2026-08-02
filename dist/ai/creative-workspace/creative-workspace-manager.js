import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ProjectState } from "../state-manager/types.js";
const EMPTY_PRODUCT = { name: "", category: "", description: "" };
const EMPTY_BRAND = { name: "" };
const EMPTY_CAMPAIGN = { name: "", objective: "" };
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/**
 * Creative Workspace Manager owns Step 1 project inputs only. It deliberately
 * has no generation, prompt, rendering, or export responsibilities.
 */
export class CreativeWorkspaceManager {
    core = null;
    root = "";
    index = { projectIds: [], activeProjectId: null, updatedAt: "" };
    async initialize(storageRoot, core) {
        this.core = core ?? null;
        this.root = path.join(storageRoot, "creative-workspace");
        await fs.mkdir(path.join(this.root, "projects"), { recursive: true });
        this.index = await this.readJson(this.indexPath(), {
            projectIds: [], activeProjectId: null, updatedAt: new Date().toISOString(),
        });
        await this.saveIndex();
    }
    async createProject(name) {
        this.ensureInitialized();
        const trimmedName = name.trim();
        if (!trimmedName)
            throw new Error("Project name is required");
        const now = new Date().toISOString();
        const project = {
            id: randomUUID(),
            name: trimmedName,
            createdAt: now,
            modifiedAt: now,
            productImages: [],
            productInformation: { ...EMPTY_PRODUCT },
            brandInformation: { ...EMPTY_BRAND },
            campaignInformation: { ...EMPTY_CAMPAIGN },
            targetAudience: "",
            language: "en",
            platform: "instagram",
            workspaceSettings: {},
        };
        await fs.mkdir(this.projectPath(project.id), { recursive: true });
        this.index.projectIds.unshift(project.id);
        this.index.activeProjectId = project.id;
        await this.persist(project, true);
        return project;
    }
    async listProjects() {
        this.ensureInitialized();
        const projects = await Promise.all(this.index.projectIds.map((id) => this.getProject(id)));
        return projects.filter((project) => project !== null)
            .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    }
    async getProject(projectId) {
        this.ensureInitialized();
        return this.readJson(this.projectFile(projectId), null);
    }
    async getActiveProject() {
        return this.index.activeProjectId ? this.getProject(this.index.activeProjectId) : null;
    }
    async openProject(projectId) {
        const project = await this.requireProject(projectId);
        this.index.activeProjectId = project.id;
        await this.saveIndex();
        this.transition(project.id, ProjectState.Open);
        return project;
    }
    async updateProject(projectId, changes) {
        const project = await this.requireProject(projectId);
        const updated = {
            ...project,
            ...changes,
            name: changes.name?.trim() ?? project.name,
            productInformation: { ...project.productInformation, ...changes.productInformation },
            brandInformation: { ...project.brandInformation, ...changes.brandInformation },
            campaignInformation: { ...project.campaignInformation, ...changes.campaignInformation },
            workspaceSettings: { ...project.workspaceSettings, ...changes.workspaceSettings },
            modifiedAt: new Date().toISOString(),
        };
        await this.persist(updated);
        return updated;
    }
    async uploadImage(projectId, image) {
        const project = await this.requireProject(projectId);
        if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
            throw new Error("Only JPEG, PNG, and WebP product images are supported");
        }
        const data = Buffer.from(image.dataBase64, "base64");
        if (!data.length || data.length > MAX_IMAGE_BYTES) {
            throw new Error("Product image must be between 1 byte and 15 MB");
        }
        const extension = image.mimeType.split("/")[1];
        const id = randomUUID();
        const safeName = path.basename(image.fileName).replace(/[^a-zA-Z0-9._-]/g, "_") || `product.${extension}`;
        const storedName = `${id}.${extension}`;
        const imageDirectory = path.join(this.projectPath(projectId), "images");
        await fs.mkdir(imageDirectory, { recursive: true });
        await fs.writeFile(path.join(imageDirectory, storedName), data);
        const uploaded = {
            id,
            fileName: safeName,
            mimeType: image.mimeType,
            sizeBytes: data.length,
            uploadedAt: new Date().toISOString(),
            url: `/api/workspace/projects/${projectId}/images/${storedName}`,
        };
        project.productImages.push(uploaded);
        project.modifiedAt = uploaded.uploadedAt;
        await this.persist(project);
        return uploaded;
    }
    async getImagePath(projectId, imageFile) {
        if (!/^[a-f0-9-]+\.(jpeg|png|webp)$/i.test(imageFile))
            return null;
        const filePath = path.join(this.projectPath(projectId), "images", imageFile);
        try {
            await fs.access(filePath);
            return filePath;
        }
        catch {
            return null;
        }
    }
    validate(project) {
        const errors = [];
        if (!project)
            errors.push("Create or open a project before continuing.");
        if (!project)
            return { valid: false, errors };
        if (!project.name.trim())
            errors.push("Project name is required.");
        if (!project.productImages.length)
            errors.push("Upload at least one product image.");
        if (!project.productInformation.name.trim())
            errors.push("Product name is required.");
        if (!project.productInformation.category.trim())
            errors.push("Product category is required.");
        if (!project.productInformation.description.trim())
            errors.push("Product description is required.");
        if (!project.brandInformation.name.trim())
            errors.push("Brand name is required.");
        if (!project.campaignInformation.name.trim())
            errors.push("Campaign name is required.");
        if (!project.campaignInformation.objective.trim())
            errors.push("Campaign objective is required.");
        if (!project.targetAudience.trim())
            errors.push("Target audience is required.");
        if (!project.language.trim())
            errors.push("Language is required.");
        if (!project.platform.trim())
            errors.push("Platform is required.");
        return { valid: errors.length === 0, errors };
    }
    getIntegrationStatus() {
        return {
            aiCore: this.core !== null,
            stateManager: this.core?.stateManager !== null && this.core?.stateManager !== undefined,
            moduleManager: this.core?.moduleManager !== null && this.core?.moduleManager !== undefined,
            memoryFoundation: this.core?.memoryFoundation !== null && this.core?.memoryFoundation !== undefined,
            knowledgeFoundation: this.core?.knowledgeFoundation !== null && this.core?.knowledgeFoundation !== undefined,
        };
    }
    async persist(project, isNew = false) {
        this.transition(project.id, isNew ? ProjectState.Open : ProjectState.Modified);
        this.transition(project.id, ProjectState.Saving);
        await this.writeJson(this.projectFile(project.id), project);
        await this.saveIndex();
        this.transition(project.id, ProjectState.Saved);
    }
    transition(projectId, state) {
        this.core?.stateManager?.updateProjectState(projectId, state, {
            systemAction: "creative-workspace",
            metadata: { source: "creative-workspace" },
        });
    }
    async requireProject(projectId) {
        const project = await this.getProject(projectId);
        if (!project)
            throw new Error("Project not found");
        return project;
    }
    async saveIndex() {
        this.index.updatedAt = new Date().toISOString();
        await this.writeJson(this.indexPath(), this.index);
    }
    async readJson(filePath, fallback) {
        try {
            return JSON.parse(await fs.readFile(filePath, "utf8"));
        }
        catch (error) {
            if (error.code === "ENOENT")
                return fallback;
            throw new Error(`Unable to read workspace storage: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async writeJson(filePath, value) {
        const temporaryPath = `${filePath}.${createHash("sha1").update(randomUUID()).digest("hex")}.tmp`;
        await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
        await fs.rename(temporaryPath, filePath);
    }
    ensureInitialized() {
        if (!this.root)
            throw new Error("Creative Workspace Manager is not initialized");
    }
    indexPath() { return path.join(this.root, "workspace-session.json"); }
    projectPath(projectId) { return path.join(this.root, "projects", projectId); }
    projectFile(projectId) { return path.join(this.projectPath(projectId), "project.json"); }
}
//# sourceMappingURL=creative-workspace-manager.js.map