import fs from "node:fs";
import path from "node:path";
export class GenerationProjectManager {
    logger;
    projects = new Map();
    projectsPath = "";
    catalogPath = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storage) {
        this.projectsPath = storage.getProjectsPath();
        this.catalogPath = path.join(this.projectsPath, "image-generation-project-catalog.json");
        fs.mkdirSync(this.projectsPath, { recursive: true });
        if (fs.existsSync(this.catalogPath)) {
            this.loadFromDisk();
        }
        else {
            this.persist();
        }
        this.logger.log("info", "project", "Image generation project manager initialized", {
            projectCount: this.projects.size,
        });
    }
    createProject(input) {
        const now = new Date().toISOString();
        const projectId = input.projectId ?? `img-project-${Date.now()}`;
        const project = {
            ...input,
            projectId,
            imageIds: [],
            promptIds: [],
            version: 1,
            createdAt: now,
            lastUpdated: now,
        };
        this.projects.set(projectId, project);
        this.persist();
        this.logger.log("info", "project", `Image generation project created: ${projectId}`, {
            projectName: project.projectName,
        });
        return project;
    }
    registerImage(projectId, imageId) {
        const project = this.projects.get(projectId);
        if (!project)
            return null;
        if (!project.imageIds.includes(imageId)) {
            project.imageIds.push(imageId);
            project.version += 1;
            project.lastUpdated = new Date().toISOString();
            this.projects.set(projectId, project);
            this.persist();
        }
        return project;
    }
    registerPrompt(projectId, promptId) {
        const project = this.projects.get(projectId);
        if (!project)
            return null;
        if (!project.promptIds.includes(promptId)) {
            project.promptIds.push(promptId);
            project.version += 1;
            project.lastUpdated = new Date().toISOString();
            this.projects.set(projectId, project);
            this.persist();
        }
        return project;
    }
    linkBlueprint(projectId, blueprintId) {
        const project = this.projects.get(projectId);
        if (!project)
            return null;
        project.blueprintId = blueprintId;
        project.version += 1;
        project.lastUpdated = new Date().toISOString();
        this.projects.set(projectId, project);
        this.persist();
        return project;
    }
    getProject(projectId) {
        return this.projects.get(projectId);
    }
    getProjectCount() {
        return this.projects.size;
    }
    searchProjects(query) {
        let results = [...this.projects.values()];
        if (query.brand)
            results = results.filter((p) => p.brand === query.brand);
        if (query.campaign)
            results = results.filter((p) => p.campaign === query.campaign);
        if (query.platform)
            results = results.filter((p) => p.platforms.includes(query.platform));
        if (query.resolution)
            results = results.filter((p) => p.resolutions.includes(query.resolution));
        return results.slice(0, query.limit ?? 50);
    }
    loadFromDisk() {
        const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8"));
        this.projects.clear();
        for (const project of data.projects ?? []) {
            this.projects.set(project.projectId, project);
        }
    }
    persist() {
        fs.writeFileSync(this.catalogPath, JSON.stringify({ projects: [...this.projects.values()] }, null, 2), "utf8");
    }
}
//# sourceMappingURL=generation-project-manager.js.map