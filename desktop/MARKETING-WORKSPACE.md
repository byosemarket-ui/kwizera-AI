# Marketing Campaign Manager And Content Planning Workspace

The Marketing Workspace replaces the former Marketing Studio placeholder with a modular, local campaign-planning interface. It extends the desktop only and does not modify the Business Dashboard, Brand Center, Project Workspace, AI Studio, Creative Editor, or existing intelligence engines.

## Workspace Surfaces

- Campaign dashboard with active, draft, scheduled, completed, and archived campaign counts.
- Campaign workspace with name, description, category, objective, status, priority, assigned-resource references, and notes.
- Daily, weekly, and monthly content-calendar foundations.
- Publishing-schedule placeholders for Website, Facebook, Instagram, TikTok, YouTube, and LinkedIn.
- Searchable, filterable marketing asset library with grid/list layout, previews, metadata, and favorites.
- Audience manager with category, segment, region, language, and planning notes.
- Campaign-phase timeline with navigation across creative and workflow checkpoints.

## Local Persistence

`MarketingCampaignManager` stores the campaign catalog, active campaign, asset catalog, audience records, favorites, recents, selected tab, calendar view, asset-view preference, and timeline position in `kwizera.marketing-workspace.v1`.

## Extension Points

`marketing-store.ts` exposes presentation-layer manager contracts for Campaign Workspace, Campaign Dashboard, Campaign Planner, Content Calendar, Publishing Schedule, Marketing Assets, Creative Collections, Campaign Timeline, Audiences, Metadata, Status, Search, and Workspace Synchronization. These are prepared for future adapters only.

## Scope Boundary

The workspace performs no AI content generation, publishing, marketing automation, rendering, export, authentication, financial processing, or cloud synchronization. Publishing rows are deliberately marked as placeholders. Existing Desktop Workspace status endpoints remain the future read-only integration boundary for AI Core, Workflow Engine, Communication Bus, Memory Foundation, Knowledge Foundation, and project-management context.