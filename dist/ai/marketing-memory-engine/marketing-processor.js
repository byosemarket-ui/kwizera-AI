import crypto from "node:crypto";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { CampaignStatus, CampaignType, MarketingPlatform, } from "./types.js";
function emptyContent() {
    return {
        headlines: [],
        hooks: [],
        captions: [],
        callToActions: [],
        productDescriptions: [],
        promotionalScripts: [],
        hashtags: [],
        keywords: [],
        sellingPoints: [],
        emotionalTriggers: [],
    };
}
function emptyCampaign() {
    return {
        campaignStructure: "",
        campaignFlow: "",
        openingStyle: "",
        productPresentation: "",
        benefits: [],
        customerProblem: "",
        solution: "",
        closingStrategy: "",
        offerStrategy: "",
    };
}
function emptyBranding() {
    return {
        brandVoice: "",
        brandPersonality: "",
        brandColors: [],
        brandIdentity: "",
        brandStyle: "",
        brandMessaging: "",
        logoUsage: "",
        typography: "",
    };
}
function emptySocial(platform) {
    return {
        platform,
        bestPractices: [],
        contentStyle: "",
        optimalLength: "",
        postingTips: [],
    };
}
function emptyCustomer() {
    return {
        customerInterests: [],
        customerBehaviour: [],
        customerPreferences: [],
        productCategories: [],
        preferredMarketingStyles: [],
        preferredVideoStyles: [],
        preferredLanguages: [],
    };
}
export function recordFromMemory(record) {
    const payload = (record.payload ?? {});
    return {
        campaignId: payload.campaignId ?? record.memoryId,
        memoryId: record.memoryId,
        projectId: record.relatedProject ?? payload.projectId ?? "",
        campaignName: record.title,
        product: payload.product ?? "",
        brand: payload.brand ?? "",
        campaignType: payload.campaignType ?? CampaignType.General,
        platform: payload.platform ?? MarketingPlatform.Other,
        targetAudience: payload.targetAudience ?? "",
        goal: payload.goal ?? "",
        language: payload.language ?? "en",
        campaignDate: payload.campaignDate ?? record.creationTime,
        status: payload.status ?? CampaignStatus.Draft,
        creationDate: record.creationTime,
        lastModified: record.lastUpdate,
        content: payload.content ?? emptyContent(),
        campaign: payload.campaign ?? emptyCampaign(),
        branding: payload.branding ?? emptyBranding(),
        socialMedia: payload.socialMedia ?? emptySocial(MarketingPlatform.Other),
        customer: payload.customer ?? emptyCustomer(),
        scores: payload.scores ?? {
            qualityScore: record.qualityScore,
            effectivenessScore: 50,
            engagementScore: 0,
            conversionScore: 0,
            learningScore: 0,
            aiConfidenceScore: record.qualityScore,
        },
        patterns: payload.patterns ?? [],
        relatedMemories: payload.relatedMemories ?? [],
        lessonsLearned: payload.lessonsLearned ?? [],
        strengths: payload.strengths ?? [],
        weaknesses: payload.weaknesses ?? [],
        versions: payload.versions ?? [],
        tags: record.tags,
        keywords: record.keywords,
    };
}
export class MarketingProcessor {
    foundation;
    history;
    customerStore;
    scorer;
    patternDetector;
    linker;
    learner;
    logger;
    campaigns;
    constructor(foundation, history, customerStore, scorer, patternDetector, linker, learner, logger, campaigns) {
        this.foundation = foundation;
        this.history = history;
        this.customerStore = customerStore;
        this.scorer = scorer;
        this.patternDetector = patternDetector;
        this.linker = linker;
        this.learner = learner;
        this.logger = logger;
        this.campaigns = campaigns;
    }
    async create(input) {
        const start = Date.now();
        const campaignId = input.campaignId ?? `mkt-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const now = new Date().toISOString();
        const platform = input.platform ?? MarketingPlatform.Other;
        const draft = {
            campaignId,
            memoryId: campaignId,
            projectId: input.projectId,
            campaignName: input.campaignName,
            product: input.product ?? "",
            brand: input.brand ?? "",
            campaignType: input.campaignType ?? CampaignType.General,
            platform,
            targetAudience: input.targetAudience ?? "",
            goal: input.goal ?? "",
            language: input.language ?? "en",
            campaignDate: input.campaignDate ?? now,
            status: CampaignStatus.Draft,
            creationDate: now,
            lastModified: now,
            content: { ...emptyContent(), ...input.content },
            campaign: { ...emptyCampaign(), ...input.campaign },
            branding: { ...emptyBranding(), ...input.branding },
            socialMedia: { ...emptySocial(platform), ...input.socialMedia, platform },
            customer: { ...emptyCustomer(), ...input.customer },
            scores: {
                qualityScore: 0,
                effectivenessScore: 50,
                engagementScore: 0,
                conversionScore: 0,
                learningScore: 0,
                aiConfidenceScore: 0,
            },
            patterns: [],
            relatedMemories: [],
            lessonsLearned: [],
            strengths: [],
            weaknesses: [],
            versions: [{ version: 1, timestamp: now, changeSummary: "Campaign created", memoryVersion: 1 }],
            tags: input.tags ?? [],
            keywords: input.keywords ?? [input.campaignName.toLowerCase(), input.brand ?? ""].filter(Boolean),
        };
        draft.scores = this.scorer.computeScores(draft);
        const relationships = this.linker.link(campaignId, input.projectId, draft.brand, draft.product, draft.tags);
        draft.relatedMemories = relationships.relatedMemories;
        if (input.customer) {
            this.customerStore.learn(input.customer);
        }
        const storeResult = await this.foundation.getStorageEngine().storeRecord(this.toMemoryInput(draft), "marketing-memory-engine");
        if (!storeResult.success || !storeResult.record) {
            return this.fail(campaignId, start, "Failed to store campaign");
        }
        this.campaigns.set(campaignId, draft);
        this.history.append({
            timestamp: now,
            event: "create",
            campaignId,
            projectId: input.projectId,
            detail: `Created campaign: ${input.campaignName}`,
            version: 1,
        });
        this.logger.log("info", "campaign-create", "Marketing campaign created", { campaignId });
        return {
            success: true,
            campaignId,
            memoryId: storeResult.record.memoryId,
            version: 1,
            durationMs: Date.now() - start,
            patternsDetected: 0,
        };
    }
    async update(campaignId, input) {
        const start = Date.now();
        const existing = await this.loadCampaign(campaignId);
        if (!existing)
            return this.fail(campaignId, start, "Campaign not found");
        const now = new Date().toISOString();
        const updated = {
            ...existing,
            campaignName: input.campaignName ?? existing.campaignName,
            status: input.status ?? existing.status,
            product: input.product ?? existing.product,
            brand: input.brand ?? existing.brand,
            campaignType: input.campaignType ?? existing.campaignType,
            platform: input.platform ?? existing.platform,
            targetAudience: input.targetAudience ?? existing.targetAudience,
            goal: input.goal ?? existing.goal,
            language: input.language ?? existing.language,
            content: input.content
                ? this.mergeContent(existing.content, input.content)
                : input.contentAppend
                    ? this.appendContent(existing.content, input.contentAppend)
                    : existing.content,
            campaign: input.campaign ? { ...existing.campaign, ...input.campaign } : existing.campaign,
            branding: input.branding ? { ...existing.branding, ...input.branding } : existing.branding,
            socialMedia: input.socialMedia
                ? { ...existing.socialMedia, ...input.socialMedia }
                : existing.socialMedia,
            customer: input.customer ? { ...existing.customer, ...input.customer } : existing.customer,
            tags: input.tags ?? existing.tags,
            keywords: input.keywords ?? existing.keywords,
            lessonsLearned: input.lessonsLearned
                ? [...existing.lessonsLearned, ...input.lessonsLearned]
                : existing.lessonsLearned,
            strengths: input.strengths ? [...existing.strengths, ...input.strengths] : existing.strengths,
            weaknesses: input.weaknesses
                ? [...existing.weaknesses, ...input.weaknesses]
                : existing.weaknesses,
            lastModified: now,
        };
        if (input.customer) {
            this.customerStore.learn(input.customer);
        }
        const relationships = this.linker.link(campaignId, updated.projectId, updated.brand, updated.product, updated.tags);
        updated.relatedMemories = [
            ...new Set([...updated.relatedMemories, ...relationships.relatedMemories]),
        ];
        updated.scores = this.scorer.computeScores(updated, input.effectivenessRating);
        const memoryRead = await this.foundation.getStorageEngine().getRecord(campaignId);
        const memoryVersion = (memoryRead.record?.version ?? existing.versions.length) + 1;
        const versionInfo = {
            version: existing.versions.length + 1,
            timestamp: now,
            changeSummary: this.summarizeChanges(input),
            memoryVersion,
        };
        updated.versions = [...existing.versions, versionInfo];
        const updateResult = await this.foundation.getStorageEngine().updateRecord(campaignId, {
            title: updated.campaignName,
            tags: updated.tags,
            keywords: updated.keywords,
            qualityScore: updated.scores.qualityScore,
            payload: this.toPayload(updated),
        }, "marketing-memory-engine");
        if (!updateResult.success) {
            return this.fail(campaignId, start, "Failed to update campaign");
        }
        let patternsDetected = 0;
        const patterns = this.patternDetector.detect(updated);
        if (patterns.length > 0) {
            updated.patterns = [...updated.patterns, ...patterns];
            patternsDetected = patterns.length;
            await this.foundation.getStorageEngine().updateRecord(campaignId, { payload: this.toPayload(updated) }, "marketing-memory-engine");
        }
        this.campaigns.set(campaignId, updated);
        this.history.append({
            timestamp: now,
            event: patternsDetected > 0 ? "pattern" : "update",
            campaignId,
            projectId: updated.projectId,
            detail: versionInfo.changeSummary,
            version: versionInfo.version,
        });
        return {
            success: true,
            campaignId,
            memoryId: campaignId,
            version: versionInfo.version,
            durationMs: Date.now() - start,
            patternsDetected,
        };
    }
    async complete(campaignId, effectivenessRating) {
        const existing = await this.loadCampaign(campaignId);
        if (!existing) {
            return {
                success: false,
                campaignId,
                patternsStored: 0,
                recommendations: [],
                strengths: [],
                weaknesses: [],
            };
        }
        await this.update(campaignId, {
            status: CampaignStatus.Completed,
            effectivenessRating,
        });
        const campaign = (await this.loadCampaign(campaignId));
        const patterns = this.patternDetector.detect(campaign);
        campaign.patterns = [...campaign.patterns, ...patterns];
        await this.foundation.getStorageEngine().updateRecord(campaignId, { payload: this.toPayload(campaign) }, "marketing-memory-engine");
        this.campaigns.set(campaignId, campaign);
        const learning = await this.learner.learnFromCompletedCampaign(campaign, patterns.length);
        this.history.append({
            timestamp: new Date().toISOString(),
            event: "complete",
            campaignId,
            projectId: campaign.projectId,
            detail: `Campaign completed with ${patterns.length} pattern(s)`,
        });
        this.logger.log("info", "campaign-complete", "Campaign completed and learned", { campaignId });
        return learning;
    }
    async loadCampaign(campaignId) {
        const cached = this.campaigns.get(campaignId);
        if (cached)
            return cached;
        const read = await this.foundation.getStorageEngine().getRecord(campaignId);
        if (!read.success || !read.record)
            return null;
        const record = recordFromMemory(read.record);
        this.campaigns.set(campaignId, record);
        return record;
    }
    mergeContent(existing, partial) {
        const merged = { ...existing };
        for (const key of Object.keys(partial)) {
            if (partial[key])
                merged[key] = partial[key];
        }
        return merged;
    }
    appendContent(existing, partial) {
        const merged = { ...existing };
        for (const key of Object.keys(partial)) {
            const vals = partial[key];
            if (vals?.length)
                merged[key] = [...existing[key], ...vals];
        }
        return merged;
    }
    toMemoryInput(campaign) {
        return {
            memoryId: campaign.campaignId,
            memoryType: MemoryStorageType.Marketing,
            category: "marketing",
            title: campaign.campaignName,
            description: `${campaign.brand} ${campaign.campaignType} campaign - ${campaign.goal}`,
            source: "marketing-memory-engine",
            tags: campaign.tags,
            keywords: campaign.keywords,
            relatedProject: campaign.projectId,
            qualityScore: campaign.scores.qualityScore,
            payload: this.toPayload(campaign),
        };
    }
    toPayload(campaign) {
        return {
            campaignId: campaign.campaignId,
            projectId: campaign.projectId,
            product: campaign.product,
            brand: campaign.brand,
            campaignType: campaign.campaignType,
            platform: campaign.platform,
            targetAudience: campaign.targetAudience,
            goal: campaign.goal,
            language: campaign.language,
            campaignDate: campaign.campaignDate,
            status: campaign.status,
            content: campaign.content,
            campaign: campaign.campaign,
            branding: campaign.branding,
            socialMedia: campaign.socialMedia,
            customer: campaign.customer,
            scores: campaign.scores,
            patterns: campaign.patterns,
            relatedMemories: campaign.relatedMemories,
            lessonsLearned: campaign.lessonsLearned,
            strengths: campaign.strengths,
            weaknesses: campaign.weaknesses,
            versions: campaign.versions,
        };
    }
    summarizeChanges(input) {
        const parts = [];
        if (input.status)
            parts.push(`status→${input.status}`);
        if (input.content)
            parts.push("content updated");
        if (input.contentAppend)
            parts.push("content appended");
        if (input.campaign)
            parts.push("campaign structure updated");
        if (input.branding)
            parts.push("branding updated");
        if (input.customer)
            parts.push("customer insights updated");
        return parts.length > 0 ? parts.join(", ") : "Campaign updated";
    }
    fail(campaignId, start, reason) {
        this.logger.log("error", "error", reason, { campaignId });
        return {
            success: false,
            campaignId,
            memoryId: campaignId,
            version: 0,
            durationMs: Date.now() - start,
            patternsDetected: 0,
            reason,
        };
    }
}
//# sourceMappingURL=marketing-processor.js.map