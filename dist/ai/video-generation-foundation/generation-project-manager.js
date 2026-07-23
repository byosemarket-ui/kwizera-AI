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
        this.catalogPath = path.join(this.projectsPath, "generation-project-catalog.json");
        fs.mkdirSync(this.projectsPath, { recursive: true });
        if (fs.existsSync(this.catalogPath)) {
            this.loadFromDisk();
        }
        else {
            this.persist();
        }
        this.logger.log("info", "project", "Generation project manager initialized", {
            projectCount: this.projects.size,
        });
    }
    createProject(input) {
        const now = new Date().toISOString();
        const projectId = input.projectId ?? `gen-project-${Date.now()}`;
        const project = {
            ...input,
            projectId,
            videoIds: [],
            sceneIds: [],
            timelineIds: [],
            version: 1,
            createdAt: now,
            lastUpdated: now,
        };
        this.projects.set(projectId, project);
        this.persist();
        this.logger.log("info", "project", `Generation project created: ${projectId}`, {
            projectName: project.projectName,
        });
        return project;
    }
    registerVideo(projectId, videoId) {
        const project = this.projects.get(projectId);
        if (!project)
            return null;
        if (!project.videoIds.includes(videoId)) {
            project.videoIds.push(videoId);
            project.version += 1;
            project.lastUpdated = new Date().toISOString();
            this.projects.set(projectId, project);
            this.persist();
        }
        return project;
    }
    registerScene(projectId, sceneId) {
        const project = this.projects.get(projectId);
        if (!project)
            return null;
        if (!project.sceneIds.includes(sceneId)) {
            project.sceneIds.push(sceneId);
            project.version += 1;
            project.lastUpdated = new Date().toISOString();
            this.projects.set(projectId, project);
            this.persist();
        }
        return project;
    }
    registerTimeline(projectId, timelineId) {
        const project = this.projects.get(projectId);
        if (!project)
            return null;
        if (!project.timelineIds.includes(timelineId)) {
            project.timelineIds.push(timelineId);
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