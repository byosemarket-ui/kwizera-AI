# Step 1: AI Me Conversation & Understanding Engine

## 1. Decision

Step 1 is implemented as a local, core-owned conversation foundation. It is not certified as a model-driven or multi-agent assistant because neither capability has verified runtime evidence in this workspace.

## 2. Inspection Scope

Inspected AI Core lifecycle/session/context ownership, model runtime references, memory and knowledge foundations, decision/planning/workflow/task owners, communication bus, persistent server, AI Studio UI, dashboard surfaces, and unit-test conventions.

## 3. Existing-State Findings

AI Studio previously stored browser-local messages and appended a canned response. No server conversation route, conversation owner, intent classifier, clarification policy, or durable conversation history existed. Multi-agent status references do not represent an implemented multi-agent runtime.

## 4. Architecture Decision

`AiConversationEngine` is owned by `AiCoreManager`, registered as an `AiModulePlugin`, and starts after the memory and knowledge foundations. It uses the existing `AiCoordinator` to obtain a core session; it does not create a second session subsystem.

## 5. Conversation Management

The engine creates and resumes opaque conversation IDs, retains a bounded 100-conversation / 100-message-per-conversation history, and writes atomically to `conversation-engine/conversations.json` under the configured local storage root.

## 6. Context Tracking

Each request performs bounded retrieval against existing memory and knowledge retrieval engines when their foundations are ready. Responses expose only match counts and project-availability state, avoiding accidental disclosure of retrieved content.

## 7. Intent Understanding

Deterministic local rules identify image generation, video generation, product analysis, editing, marketing, translation, project management, system, and general requests. The response plan identifies the responsible existing engines and a complexity level.

## 8. Clarification Policy

Short creative requests require outcome detail; editing and project-management requests require a project. Unknown project IDs are blocked from workflow readiness. The engine prepares plans only and does not trigger a generation, edit, or workflow without an explicit later confirmation path.

## 9. Language Handling

The engine identifies English, Kinyarwanda, and mixed input through a deliberately small deterministic vocabulary and supplies English or Kinyarwanda clarification/plan phrasing. This is routing support, not verified natural-language fluency or translation quality.

## 10. Response Generation

Responses are deterministic and truthful when no verified local language provider is attached. The engine does not manufacture LLM output. Connecting provider-backed natural responses remains dependent on a healthy configured local inference provider and needs a separately tested prompt contract.

## 11. Memory Integration

Conversation history has its own bounded local runtime store while contextual retrieval uses the existing Memory Foundation. This avoids treating chat transcript storage as a replacement for project, learning, preference, or decision memory owners.

## 12. Knowledge Integration

Existing Knowledge Foundation retrieval is queried opportunistically. Retrieval failures are contained so a temporarily unavailable index does not prevent local clarification or conversation persistence.

## 13. Decisions, Planning, And Workflow

The conversation plan declares candidate engines and `readyForWorkflow`; it does not duplicate the decision, planning, task, or workflow systems. No silent execution occurs. A future explicit confirmation endpoint must invoke the existing planning/workflow contracts rather than embed a second executor here.

## 14. API And UI

`GET /api/conversations` lists persisted conversations and `POST /api/conversations` accepts a message, optional conversation ID, and optional project ID. AI Studio now calls the API, stores the server conversation ID in its local display session, and shows a truthful local-service error if runtime restoration is incomplete.

## 15. Security And Performance

Messages are trimmed, control-character rejected, and limited to 6,000 characters. Retention bounds and retrieval limits constrain local storage and query cost. The API remains loopback-local under the existing server design; it has no authentication, authorization, user isolation, or deletion endpoint, so it is not suitable for multi-user exposure.

## 16. Validation Evidence

Static diagnostics reported no errors in the engine, core manager, server, exports, UI, or focused unit test. The new unit test covers persisted history, mixed-language image intent, and missing-detail clarification. `npm exec vitest run tests/unit/ai/conversation/conversation-engine.test.ts` returned no output in this terminal environment, so it is unverified and must not be reported as passing.

## 17. Step 1 Readiness And Limits

The prior placeholder chat is replaced by a real local conversation request path with persistence, bounded foundation retrieval, intent routing, and confirmation gating. Still outstanding: verified provider-backed generation, comprehensive Kinyarwanda language evaluation, actual decision/workflow execution after confirmation, authenticated user isolation, transcript deletion/export controls, and a real multi-agent implementation. Step 2 has not been started.