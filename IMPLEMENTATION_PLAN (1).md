# IMPLEMENTATION PLAN --- Document Summary Assistant

> **Document Status:** Execution Source of Truth\
> **Version:** 1.0\
> **Depends On:** `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`,
> `API_AND_DATA.md`\
> **Purpose:** Define the exact implementation strategy, dependency
> order, milestones, agent responsibilities, acceptance criteria,
> verification gates, and implementation guardrails for building the
> Document Summary Assistant with AI coding agents.

------------------------------------------------------------------------

# 1. Purpose

This document answers one question:

> **What should be built next, by whom, in what order, against which
> contracts, and how do we know it is correct?**

It is not a feature wish list.

It is a dependency-driven execution plan.

AI agents must not skip ahead simply because a later feature appears
easier to implement. Each milestone establishes foundations required by
later milestones.

The required implementation order is:

``` text
Foundation
    ↓
Data Model
    ↓
Provider Boundaries
    ↓
Document Upload
    ↓
Document Processing
    ↓
AI Summarization
    ↓
Processing Status
    ↓
Frontend Experience
    ↓
Reliability
    ↓
Testing & Evaluation
    ↓
Deployment & Submission Readiness
```

------------------------------------------------------------------------

# 2. Source-of-Truth Hierarchy

When instructions conflict, use this order:

``` text
1. Original assignment requirements
2. PROJECT_CONTEXT.md
3. ARCHITECTURE.md
4. API_AND_DATA.md
5. IMPLEMENTATION_PLAN.md
6. Existing repository conventions
7. Agent assumptions
```

An AI agent must never override an explicit higher-level requirement
with its own preferred architecture.

If a required decision is genuinely missing, the agent must:

1.  Identify the ambiguity.
2.  Check existing project context and code.
3.  Choose the smallest reversible implementation if allowed.
4.  Document the decision in the implementation notes or decision log.
5.  Avoid introducing unrelated infrastructure.

------------------------------------------------------------------------

# 3. Implementation Philosophy

The project must be built according to the following principles.

## 3.1 Build Vertical Slices, Not Isolated Technology Layers

A milestone should produce observable progress.

Bad:

``` text
Week 1: Build all backend utilities.
Week 2: Build all database code.
Week 3: Start the UI.
```

Preferred:

``` text
Upload
  → Persist document
  → Store file
  → Retrieve document
  → Display status
```

Each completed milestone should leave the application in a testable
state.

------------------------------------------------------------------------

## 3.2 Establish Boundaries Before Complexity

Before adding:

-   OCR
-   queues
-   caching
-   fallback providers
-   concurrency controls
-   advanced observability

first establish:

-   interfaces
-   validation
-   state management
-   clear ownership

The project should become more capable without becoming harder to reason
about.

------------------------------------------------------------------------

## 3.3 Prefer Working Simplicity Over Decorative Architecture

Do not add:

-   Kafka
-   Kubernetes
-   multiple microservices
-   multiple databases
-   vector databases
-   multiple AI providers
-   distributed tracing systems

unless the project requirements or proven implementation constraints
justify them.

A simple architecture with correct boundaries is stronger than an
impressive diagram backed by fragile code.

------------------------------------------------------------------------

# 4. Pre-Implementation Rules

Before changing implementation code, every AI agent must read:

``` text
PROJECT_CONTEXT.md
ARCHITECTURE.md
API_AND_DATA.md
IMPLEMENTATION_PLAN.md
```

The agent must also inspect:

``` text
package.json
existing source tree
environment configuration
database schema
existing API routes
existing tests
```

The agent must not blindly recreate files that already exist.

Before each major change:

``` text
Understand current state
        ↓
Identify affected contract
        ↓
Implement smallest coherent change
        ↓
Run validation
        ↓
Inspect failures
        ↓
Fix failures
        ↓
Report completed scope
```

------------------------------------------------------------------------

# 5. Repository Initialization Milestone

## Goal

Create a clean, maintainable project foundation before feature work
begins.

## Required Tasks

### 5.1 Initialize Next.js

Recommended baseline:

``` text
Next.js
React
TypeScript
```

The application must have:

-   TypeScript strict mode where practical
-   Clear source organization
-   Environment variable support
-   Production build capability

------------------------------------------------------------------------

### 5.2 Styling Foundation

Recommended:

``` text
Tailwind CSS
shadcn/ui
```

Do not spend excessive time implementing visual polish before the core
document pipeline works.

------------------------------------------------------------------------

### 5.3 Runtime Validation

Install and configure:

``` text
Zod
```

Zod will be used at external boundaries:

-   API requests
-   Provider outputs
-   configuration where appropriate

------------------------------------------------------------------------

### 5.4 Database Tooling

Recommended direction:

``` text
PostgreSQL
Prisma
```

Required outcome:

``` text
Application
     ↓
Prisma Client
     ↓
PostgreSQL
```

No feature should directly depend on database-specific implementation
details outside repository/infrastructure boundaries unless the chosen
code architecture intentionally centralizes that access.

------------------------------------------------------------------------

## Acceptance Criteria

The milestone is complete only when:

-   Development server starts.
-   Production build succeeds.
-   Environment variables can be loaded.
-   Database connection can be verified.
-   Prisma schema can be validated.
-   Basic lint/type checks succeed.
-   Repository structure is understandable.

------------------------------------------------------------------------

# 6. Core Data Model Milestone

## Goal

Implement the minimum durable model required to represent:

``` text
Document
Processing lifecycle
Summary
```

Do not implement speculative product entities.

------------------------------------------------------------------------

## 6.1 Required Initial Entities

At minimum, the implementation must support:

### Document

``` text
id
originalFileName
fileType
mimeType
fileSizeBytes
storageKey
status
currentStage
extractionMethod
createdAt
updatedAt
completedAt?
failedAt?
```

### Summary

``` text
id
documentId
length
title
summary
keyPoints
mainIdeas
processingVersion
createdAt
updatedAt
```

The exact physical schema may evolve, but the logical contract must
remain consistent with `API_AND_DATA.md`.

------------------------------------------------------------------------

## 6.2 Required Enums

Implement only required values:

``` text
DocumentStatus
ProcessingStage
FileType
ExtractionMethod
SummaryLength
```

Do not add speculative states unless implementation requires them.

------------------------------------------------------------------------

## 6.3 Database Constraints

The implementation should enforce meaningful constraints where
appropriate.

Examples:

-   Summary must reference a valid document.
-   Required document metadata cannot be null after creation where
    logically required.
-   Duplicate equivalent summaries should be considered intentionally.

The exact uniqueness strategy may depend on the chosen summary
lifecycle.

------------------------------------------------------------------------

## Acceptance Criteria

Before proceeding:

-   Schema migration succeeds.
-   A document can be created.
-   A document can be retrieved.
-   A summary can be linked to a document.
-   Invalid enum values cannot be persisted through normal application
    paths.
-   Type generation succeeds.
-   Basic database operations are tested.

------------------------------------------------------------------------

# 7. Provider Boundary Milestone

## Goal

Create clean interfaces before integrating external vendors.

The application should not spread vendor-specific code across feature
modules.

------------------------------------------------------------------------

## 7.1 Storage Boundary

Conceptual capability:

``` text
StorageProvider
├── upload()
├── getObject()
├── delete()
└── optional: createUploadUrl()
```

The exact methods may vary based on the upload design.

The domain/application layer should not need to know whether the
implementation uses:

``` text
Cloudflare R2
Amazon S3
Another S3-compatible provider
```

------------------------------------------------------------------------

## 7.2 Extraction Boundary

Conceptual capability:

``` text
DocumentExtractionProvider
└── extract(document)
```

Result should be normalized into an application-owned shape.

Example:

``` text
ExtractionResult {
    text
    pageCount?
    characterCount
    metadata?
}
```

The provider should not return arbitrary vendor objects directly to
business logic.

------------------------------------------------------------------------

## 7.3 OCR Boundary

Conceptual capability:

``` text
OCRProvider
└── extract(document)
```

OCR must remain independently replaceable.

------------------------------------------------------------------------

## 7.4 AI Boundary

Conceptual capability:

``` text
SummarizationProvider
└── summarize(request)
```

The request should contain application-level concepts:

``` text
content
summaryLength
output requirements
```

The rest of the application should not be tightly coupled to
provider-specific request syntax.

------------------------------------------------------------------------

## Acceptance Criteria

Before proceeding:

-   Interfaces/types are defined.
-   Provider-specific logic is isolated.
-   A mock or fake provider can be substituted for tests.
-   No AI key is exposed to the browser.
-   No storage secret is exposed to the browser.

------------------------------------------------------------------------

# 8. File Validation Milestone

## Goal

Reject invalid files before expensive processing begins.

Validation must exist on the server.

------------------------------------------------------------------------

## Required Checks

The server must validate, as supported by the implementation:

``` text
Supported logical file type
Allowed MIME type
File size limit
Empty file
Invalid/corrupt input where detectable
```

Client validation is only for faster user feedback.

------------------------------------------------------------------------

## Error Behavior

Invalid input must return the standardized error shape:

``` json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "User-safe explanation"
  }
}
```

Examples:

``` text
UNSUPPORTED_FILE_TYPE
FILE_TOO_LARGE
EMPTY_FILE
INVALID_FILE
```

------------------------------------------------------------------------

## Acceptance Criteria

Test at least:

-   Valid PDF.
-   Valid supported image.
-   Unsupported extension.
-   Unsupported MIME type.
-   Oversized file.
-   Empty file.

------------------------------------------------------------------------

# 9. Upload and Storage Milestone

## Goal

Create a durable upload flow.

The primary upload architecture must be finalized before implementation.

Choose one:

``` text
A. Server-mediated upload
B. Direct-to-object-storage upload
```

Do not implement both as production paths without a requirement.

------------------------------------------------------------------------

## 9.1 Required Flow

``` text
User selects file
        ↓
Preliminary client validation
        ↓
Server validation / upload authorization
        ↓
Document record created
        ↓
File stored
        ↓
Document state updated
        ↓
Processing initiated or scheduled
```

------------------------------------------------------------------------

## 9.2 Failure Handling

Consider failure points:

``` text
Database creation fails
Storage upload fails
Upload succeeds but completion callback fails
Duplicate completion request occurs
Processing cannot start
```

The implementation must avoid leaving unexplained permanent states.

------------------------------------------------------------------------

## Acceptance Criteria

-   Uploaded file is retrievable by the processing layer.
-   Database stores document metadata.
-   Storage keys are not exposed unnecessarily.
-   Failed upload does not incorrectly mark document as successfully
    ready.
-   Repeated client behavior does not create uncontrolled duplicate
    records.
-   API response matches the selected contract.

------------------------------------------------------------------------

# 10. Document Processing State Machine Milestone

## Goal

Implement lifecycle management before extraction.

The system must be able to answer:

> What is happening to this document right now?

------------------------------------------------------------------------

## Required States

Overall:

``` text
UPLOADED
PROCESSING
COMPLETED
FAILED
```

Stage:

``` text
UPLOADING
UPLOADED
EXTRACTING
OCR_PROCESSING
NORMALIZING
SUMMARIZING
COMPLETED
FAILED
```

Not every transient state must necessarily be stored if the
implementation architecture makes that impractical, but externally
observable state must remain consistent.

------------------------------------------------------------------------

## Required Behavior

The implementation must prevent arbitrary invalid transitions.

Example:

``` text
COMPLETED
    ↓
SUMMARIZING
```

should not happen accidentally.

Retries must explicitly reset or create a new processing attempt
according to the chosen implementation.

------------------------------------------------------------------------

## Acceptance Criteria

-   Valid transitions work.
-   Invalid transitions are rejected or impossible through service
    boundaries.
-   Failure can occur from processing stages.
-   Terminal states are identifiable.
-   Status endpoint returns durable server state.

------------------------------------------------------------------------

# 11. Native Document Extraction Milestone

## Goal

Successfully extract usable text from a normal digital PDF.

Start with the simplest high-quality extraction path.

Do not add OCR yet.

------------------------------------------------------------------------

## Required Pipeline

``` text
Stored File
    ↓
Retrieve for processing
    ↓
Native extraction
    ↓
Validate result
    ↓
Return normalized extraction result
```

------------------------------------------------------------------------

## Extraction Result Checks

At minimum evaluate:

``` text
Character count
Non-whitespace content
Extraction success/failure
```

Do not assume that a technically successful library call means useful
text was extracted.

------------------------------------------------------------------------

## Acceptance Criteria

Test against:

-   Standard digital PDF.
-   Multi-page PDF.
-   PDF with little text.
-   Invalid/corrupted PDF if possible.

The implementation should distinguish:

``` text
Extraction operation failed
```

from:

``` text
Extraction succeeded but produced insufficient useful text
```

This distinction is necessary for OCR routing.

------------------------------------------------------------------------

# 12. OCR Routing Milestone

## Goal

Add OCR only when native extraction is insufficient or the file is an
image.

------------------------------------------------------------------------

## Required Decision Flow

``` text
Input
  ↓
Is image?
  ├── Yes → OCR
  └── No
         ↓
     Native extraction
         ↓
     Usable text?
      ├── Yes → Normalize
      └── No → OCR
```

The criteria for "usable text" must be implemented as explicit, testable
logic.

Avoid hidden magic behavior.

------------------------------------------------------------------------

## Important Rule

Do not OCR every PDF.

OCR is more expensive and generally slower than native extraction.

------------------------------------------------------------------------

## Acceptance Criteria

-   Digital PDF normally uses native extraction.
-   Scanned PDF can route to OCR.
-   Image routes to OCR.
-   OCR failure produces a controlled error.
-   OCR does not silently return an empty successful result.

------------------------------------------------------------------------

# 13. Content Normalization Milestone

## Goal

Prepare extracted content for summarization without destroying useful
meaning.

------------------------------------------------------------------------

## Required Processing

Potential operations:

``` text
Whitespace cleanup
Removal of obvious extraction artifacts
Line normalization
Section preservation when available
Empty-content detection
```

Avoid aggressive transformations that:

-   merge unrelated paragraphs
-   remove headings
-   reorder text
-   destroy document structure

------------------------------------------------------------------------

## Acceptance Criteria

-   Normal output is non-empty.
-   Input with only whitespace fails meaningfully.
-   Text remains readable.
-   Major document ordering is preserved.
-   Normalization can be tested independently.

------------------------------------------------------------------------

# 14. Summarization Strategy Milestone

## Goal

Implement the decision layer that chooses direct or hierarchical
summarization.

This milestone must exist before AI calls are scattered throughout the
codebase.

------------------------------------------------------------------------

## Required Decision

``` text
Normalized content
        ↓
Estimate size
        ↓
Fits configured threshold?
    ├── Yes → Direct summary
    └── No  → Chunked summary
```

The size threshold must be configurable.

Do not hardcode an unexplained magic number.

------------------------------------------------------------------------

## Acceptance Criteria

-   Small content chooses direct path.
-   Large content chooses chunked path.
-   Boundary conditions are tested.
-   Strategy selection is independent from the UI.

------------------------------------------------------------------------

# 15. Direct AI Summarization Milestone

## Goal

Generate one structured summary from a document that fits within the
configured strategy.

------------------------------------------------------------------------

## Required Inputs

``` text
Normalized content
Summary length
Structured output requirements
```

------------------------------------------------------------------------

## Required Summary Lengths

``` text
SHORT
MEDIUM
LONG
```

These should affect output expectations without creating three
disconnected pipelines.

------------------------------------------------------------------------

## Required Result Shape

``` text
title
summary
keyPoints[]
mainIdeas[]
```

The provider output must be validated using the application schema
before persistence.

------------------------------------------------------------------------

## Failure Behavior

If the provider:

-   times out
-   returns malformed output
-   returns empty output
-   becomes unavailable

the document must not be marked as successfully summarized.

------------------------------------------------------------------------

## Acceptance Criteria

For each length:

``` text
SHORT
MEDIUM
LONG
```

verify:

-   A result is generated.
-   Required fields are present.
-   Schema validation passes.
-   Result persists.
-   Result can be retrieved.

------------------------------------------------------------------------

# 16. Large Document / Hierarchical Summarization Milestone

## Goal

Handle documents that exceed the configured direct summarization
threshold.

------------------------------------------------------------------------

## Required Pipeline

``` text
Normalized Document
        ↓
Structure-aware chunking
        ↓
Chunk summaries
        ↓
Aggregate intermediate summaries
        ↓
Final summary
        ↓
Schema validation
        ↓
Persistence
```

------------------------------------------------------------------------

## Chunking Rules

Preferred order:

``` text
Section
    ↓
Paragraph
    ↓
Sentence
    ↓
Hard limit
```

Do not split blindly when useful boundaries are available.

------------------------------------------------------------------------

## Concurrency

Chunk processing may be concurrent.

However:

``` text
Concurrency = configurable
```

Do not launch an unbounded number of AI requests.

Future controls may include:

-   Provider rate limits
-   Maximum concurrent chunks
-   Retry budgets

------------------------------------------------------------------------

## Acceptance Criteria

Test with a document large enough to force:

``` text
Chunking
→ Multiple partial summaries
→ Final aggregation
```

Verify:

-   No chunk is silently dropped.
-   Final output validates.
-   Processing failure is observable.
-   AI calls remain bounded.

------------------------------------------------------------------------

# 17. AI Output Validation Milestone

## Goal

Make structured validation a mandatory success gate.

Required pipeline:

``` text
Provider response
       ↓
Parse/normalize
       ↓
Zod validation
       ↓
Valid?
  ├── Yes → persist
  └── No  → controlled failure/retry behavior
```

Never persist malformed AI output as a successful summary merely because
the provider returned HTTP 200.

------------------------------------------------------------------------

## Acceptance Criteria

Simulate:

-   Missing title.
-   Invalid keyPoints type.
-   Empty summary.
-   Malformed JSON/structured response.
-   Valid response.

Only valid output may become a completed summary.

------------------------------------------------------------------------

# 18. Processing Orchestration Milestone

## Goal

Create one clear orchestration path.

The orchestration service should coordinate:

``` text
Document
    ↓
Extraction routing
    ↓
Native extraction or OCR
    ↓
Normalization
    ↓
Summarization strategy
    ↓
AI generation
    ↓
Validation
    ↓
Persistence
    ↓
Final state
```

Avoid putting the entire pipeline directly inside an HTTP route handler.

The route should initiate or invoke an application service.

------------------------------------------------------------------------

## Required Failure Handling

Each major stage should produce controlled behavior:

``` text
Storage failure
Extraction failure
OCR failure
Normalization failure
AI failure
Validation failure
Database persistence failure
```

The system should preserve enough information to diagnose the failure
without exposing sensitive internals to the client.

------------------------------------------------------------------------

# 19. Background Processing Decision Milestone

## Goal

Make an explicit decision rather than accidentally mixing synchronous
and asynchronous behavior.

### Option A --- MVP Controlled Processing

Acceptable only if runtime limits and document sizes support it.

### Option B --- Dedicated Background Worker

Preferred if processing is long-running or infrastructure supports
workers cleanly.

------------------------------------------------------------------------

## Decision Requirement

Before production/demo deployment, document:

``` text
Chosen model
Reason
Known limitations
Upgrade path
```

If a queue is added, it must solve a real execution problem.

------------------------------------------------------------------------

## Future Direction

A future scalable path may be:

``` text
API
  ↓
Queue
  ↓
Document Worker
  ↓
AI Worker
```

Redis + BullMQ is a potential future direction, not an automatic current
requirement.

------------------------------------------------------------------------

# 20. Status Delivery Milestone

## Goal

Expose processing state clearly to the frontend.

MVP recommendation:

``` text
Polling
```

Flow:

``` text
Frontend
   ↓
GET /documents/{id}/status
   ↓
Database-backed state
```

------------------------------------------------------------------------

## Required Client Behavior

Polling starts after processing begins.

Polling stops when:

``` text
COMPLETED
FAILED
```

The frontend must not continue polling after a terminal state.

------------------------------------------------------------------------

## Acceptance Criteria

-   UI receives stage changes.
-   Completed state stops polling.
-   Failed state stops polling.
-   Network errors do not immediately create false failure UI.
-   User can distinguish processing from permanent failure.

------------------------------------------------------------------------

# 21. Summary Retrieval Milestone

## Goal

Display persisted server-generated summaries.

The UI should retrieve canonical backend data.

It must not:

-   reconstruct AI output
-   parse provider-specific output
-   infer missing fields

------------------------------------------------------------------------

## Required UI Content

At minimum:

``` text
Title
Summary
Key Points
Main Ideas
```

------------------------------------------------------------------------

## Acceptance Criteria

-   Completed summary displays correctly.
-   Missing summary is handled.
-   Failed document displays a meaningful error state.
-   Refreshing the page does not lose completed results.

------------------------------------------------------------------------

# 22. Frontend Product Experience Milestone

## Goal

Turn the backend pipeline into a coherent user flow.

Recommended primary flow:

``` text
Landing / Upload
       ↓
File selected
       ↓
Summary length selected
       ↓
Upload
       ↓
Processing state
       ↓
Summary result
       ↓
Upload another document
```

------------------------------------------------------------------------

## Required UI States

Every primary screen must intentionally handle:

``` text
Idle
Validating
Uploading
Processing
Completed
Failed
```

Do not implement only the happy path.

------------------------------------------------------------------------

## UX Requirements

The UI should:

-   Clearly indicate what the system is doing.
-   Avoid fake precision in progress percentages.
-   Show meaningful processing stages when available.
-   Prevent duplicate submission while a request is active.
-   Allow recovery from failure where the architecture supports
    retry/re-upload.
-   Work across common desktop and mobile widths.

Visual polish matters, but correctness comes first.

------------------------------------------------------------------------

# 23. API Contract Verification Milestone

Before final UI integration, verify every implemented endpoint against
`API_AND_DATA.md`.

Check:

``` text
Request shape
Validation
Response shape
Error envelope
Status codes
Naming convention
State behavior
```

Any intentional deviation must be documented.

Do not silently let implementation drift away from the architecture
documents.

------------------------------------------------------------------------

# 24. Reliability Milestone

## Goal

Make expected failures survivable and understandable.

------------------------------------------------------------------------

## Retry Classification

Potentially retryable:

``` text
Temporary AI provider failure
Temporary storage failure
Temporary network failure
Rate limiting
```

Usually non-retryable:

``` text
Unsupported file
Empty file
Permanently corrupt file
No extractable content after all configured strategies
Invalid user input
```

------------------------------------------------------------------------

## Retry Rules

Retries must have:

``` text
Maximum attempts
Backoff
Failure classification
```

Do not implement infinite retries.

------------------------------------------------------------------------

# 25. Duplicate Processing and Idempotency Milestone

## Goal

Prevent accidental repeated expensive work.

Consider:

``` text
User double-clicks submit
Browser retries after timeout
Upload completion called twice
Summary request repeated
```

Equivalent summary detection may include:

``` text
documentId
+
summaryLength
+
processingVersion
```

Possible behavior:

``` text
Existing completed result
    → reuse result

Existing processing request
    → return current operation

No equivalent result
    → start processing
```

The exact implementation should match the final API model.

------------------------------------------------------------------------

# 26. Observability Milestone

## Goal

Make the pipeline debuggable.

At minimum, every processing operation should be traceable using:

``` text
documentId
```

Recommended event boundaries:

``` text
Upload accepted
Processing started
Extraction started
OCR selected/skipped
Normalization completed
Summarization started
Summary validated
Processing completed
Processing failed
```

Capture durations where practical:

``` text
Extraction duration
OCR duration
AI duration
Total processing duration
```

Do not log secrets, raw credentials, or unnecessarily sensitive document
content.

------------------------------------------------------------------------

# 27. Performance Milestone

Performance work must be measurement-driven.

Do not optimize hypothetical bottlenecks first.

Investigate:

``` text
Upload duration
Native extraction duration
OCR duration
AI latency
Chunk count
Aggregation latency
Database reads
```

------------------------------------------------------------------------

## Initial Optimization Priorities

1.  Avoid OCR when native extraction is sufficient.
2.  Avoid oversized AI requests.
3.  Use chunking only when needed.
4.  Avoid repeated processing of already-completed equivalent work.
5.  Avoid unnecessary server-side file transfer where direct object
    storage is appropriate.
6.  Bound concurrent AI operations.

------------------------------------------------------------------------

# 28. Security Review Milestone

Before deployment/demo, verify:

``` text
AI API keys server-only
Storage secrets server-only
Environment files not committed
Server-side file validation enabled
File size limits enforced
Internal errors not exposed
Private storage objects not publicly enumerable
```

Future production hardening may add:

-   Authentication
-   authorization
-   malware scanning
-   content security policy
-   audit logs
-   abuse prevention

Do not claim features are implemented unless they actually are.

------------------------------------------------------------------------

# 29. Testing Strategy

Testing should follow risk and architecture boundaries.

------------------------------------------------------------------------

## 29.1 Unit Tests

Prioritize:

``` text
State transitions
File validation
OCR routing logic
Usable-text detection
Normalization
Chunking
Summary strategy selection
AI output validation
Retry classification
Idempotency decisions
```

These components should be testable without calling real external
providers.

------------------------------------------------------------------------

## 29.2 Integration Tests

Test:

``` text
Database operations
Storage integration
Document creation
Processing orchestration with mocked providers
API endpoints
```

------------------------------------------------------------------------

## 29.3 End-to-End Tests

Critical journey:

``` text
Upload
  ↓
Process
  ↓
Observe status
  ↓
Retrieve summary
  ↓
Display result
```

Also test:

``` text
Invalid file
Processing failure
Large document path
OCR path
Refresh after completion
```

------------------------------------------------------------------------

## 29.4 AI Evaluation Tests

AI systems require additional evaluation beyond normal unit tests.

Maintain a small controlled evaluation set containing examples such as:

``` text
Short digital PDF
Long digital PDF
Scanned PDF
Image with text
Poor-quality extraction case
Document with clear sections
Document with repetitive content
```

Evaluate:

``` text
Output validity
Coverage
Faithfulness to source
Major information preservation
Length appropriateness
Consistency
```

Do not claim model output is always factually perfect.

------------------------------------------------------------------------

# 30. Definition of Done

A milestone is not complete because code exists.

A milestone is complete only when:

``` text
Implementation exists
        +
Relevant contracts are satisfied
        +
Happy path works
        +
Expected failure path works
        +
Validation passes
        +
Tests/checks run successfully
        +
No known blocking integration issue remains
```

------------------------------------------------------------------------

# 31. Milestone Dependency Graph

``` text
M0  Project Foundation
 |
 v
M1  Database & Domain Model
 |
 v
M2  Provider Boundaries
 |
 +------------------+
 |                  |
 v                  v
M3 File Validation  M4 Storage Integration
 |                  |
 +---------+--------+
           |
           v
M5 Upload Flow
           |
           v
M6 Processing State Machine
           |
           v
M7 Native Extraction
           |
           v
M8 OCR Routing
           |
           v
M9 Content Normalization
           |
           v
M10 Summarization Strategy
           |
     +-----+-----+
     |           |
     v           v
M11 Direct AI   M12 Large Document Path
     |           |
     +-----+-----+
           |
           v
M13 Output Validation & Persistence
           |
           v
M14 Processing Orchestration
           |
           v
M15 Status API
           |
           v
M16 Frontend Integration
           |
           v
M17 Reliability & Idempotency
           |
           v
M18 Testing & Evaluation
           |
           v
M19 Deployment & Submission Readiness
```

Parallel work is allowed only when dependencies are genuinely
independent.

------------------------------------------------------------------------

# 32. AI Agent Operating Model

AI agents should not receive vague instructions such as:

> "Build the document processing system."

Each task must include:

``` text
Objective
Relevant source documents
Current repository state
Allowed scope
Files/modules likely affected
Contracts that must not change
Acceptance criteria
Validation commands
Explicit non-goals
```

------------------------------------------------------------------------

## Recommended Agent Prompt Template

``` text
You are implementing one bounded milestone of the Document Summary Assistant.

Before changing code:
1. Read PROJECT_CONTEXT.md.
2. Read ARCHITECTURE.md.
3. Read API_AND_DATA.md.
4. Read IMPLEMENTATION_PLAN.md.
5. Inspect the current repository state.

Task:
[EXACT TASK]

Allowed scope:
[FILES/MODULES]

Do not:
- introduce unrelated dependencies
- redesign existing architecture
- change public contracts without explicit instruction
- implement future features outside scope

Requirements:
[DETAILED REQUIREMENTS]

Acceptance criteria:
[TESTABLE CONDITIONS]

Before finishing:
1. Run relevant tests.
2. Run type checking.
3. Run linting where available.
4. Inspect changed files.
5. Report:
   - files changed
   - implementation decisions
   - validation performed
   - remaining limitations
```

------------------------------------------------------------------------

# 33. Agent Roles

Multiple agents may be used, but responsibilities must not overlap
carelessly.

## Agent A --- Foundation / Data

Owns:

``` text
Repository setup
Database schema
Prisma
Domain types
Migrations
```

## Agent B --- Processing

Owns:

``` text
Extraction
OCR routing
Normalization
Chunking
Processing orchestration
```

## Agent C --- AI

Owns:

``` text
AI provider integration
Prompt construction
Summary strategy
Structured output validation
```

## Agent D --- API

Owns:

``` text
Route handlers
Request validation
Response contracts
Error mapping
Status APIs
```

## Agent E --- Frontend

Owns:

``` text
Upload UX
Processing UI
Polling
Summary result UI
Error states
Responsive behavior
```

## Agent F --- Verification

Owns:

``` text
Tests
Contract verification
Regression checks
Architecture drift detection
```

For a small project, one agent may perform multiple roles sequentially.

Do not allow multiple agents to edit the same high-conflict files
simultaneously without coordination.

------------------------------------------------------------------------

# 34. Parallelization Rules

Safe parallelization examples:

``` text
Database schema
        ||
Frontend static shell
```

only if the frontend contract is already stable.

Another example:

``` text
Provider interface definitions
        ||
UI component primitives
```

Unsafe parallelization:

``` text
Agent A changes summary schema
        ||
Agent B builds summary API from an older schema
        ||
Agent C builds UI from another assumed schema
```

Contracts must be stabilized before parallel dependent work begins.

------------------------------------------------------------------------

# 35. Integration Gates

After major milestones, stop feature expansion and integrate.

Required gates:

``` text
Gate 1 — Foundation
Gate 2 — Upload
Gate 3 — Native Processing
Gate 4 — OCR
Gate 5 — AI Summary
Gate 6 — End-to-End UX
Gate 7 — Reliability
Gate 8 — Final Verification
```

At each gate:

``` text
Build
Typecheck
Lint
Relevant tests
Manual smoke test
Contract review
```

Do not postpone all integration until the end.

------------------------------------------------------------------------

# 36. Architecture Drift Prevention

Before accepting an agent's implementation, verify:

### Does it introduce a new external dependency?

If yes:

``` text
Why?
Is an existing dependency sufficient?
Does architecture documentation need updating?
```

### Does it change a public API?

If yes:

``` text
Update API_AND_DATA.md
Check frontend compatibility
Check tests
```

### Does it change processing behavior?

If yes:

``` text
Update ARCHITECTURE.md if the architectural decision changed
Update PROJECT_CONTEXT.md if scope/decision changed
```

### Does it add a product feature?

If yes:

``` text
Confirm it belongs to current MVP scope
```

------------------------------------------------------------------------

# 37. Suggested Build Sequence for AI Agents

The recommended practical sequence is:

## Agent Task 1

``` text
Initialize project foundation
```

Output:

``` text
Working Next.js app
TypeScript
Tailwind/shadcn if selected
Zod
Database tooling
Basic quality commands
```

------------------------------------------------------------------------

## Agent Task 2

``` text
Implement Prisma data model and migrations
```

Output:

``` text
Document
Summary
Enums
Repositories/services as appropriate
```

------------------------------------------------------------------------

## Agent Task 3

``` text
Create provider interfaces and test doubles
```

Output:

``` text
Storage abstraction
Extraction abstraction
OCR abstraction
AI abstraction
```

------------------------------------------------------------------------

## Agent Task 4

``` text
Implement validated upload flow
```

Output:

``` text
File validation
Document creation
Storage integration
Correct lifecycle initialization
```

------------------------------------------------------------------------

## Agent Task 5

``` text
Implement processing state machine and status API
```

Output:

``` text
Durable states
Transition logic
Status retrieval
```

------------------------------------------------------------------------

## Agent Task 6

``` text
Implement native PDF extraction
```

Output:

``` text
Text extraction
Usable-text detection
Normalized extraction contract
```

------------------------------------------------------------------------

## Agent Task 7

``` text
Implement OCR routing and selected OCR provider
```

Output:

``` text
Image support
Scanned PDF fallback
Controlled failures
```

------------------------------------------------------------------------

## Agent Task 8

``` text
Implement normalization and summarization strategy
```

Output:

``` text
Direct path
Large-document decision path
```

------------------------------------------------------------------------

## Agent Task 9

``` text
Implement Gemini summarization provider
```

Output:

``` text
SHORT
MEDIUM
LONG
Structured output
Validation
```

------------------------------------------------------------------------

## Agent Task 10

``` text
Implement hierarchical summarization
```

Output:

``` text
Chunking
Partial summaries
Aggregation
Bounded concurrency
```

------------------------------------------------------------------------

## Agent Task 11

``` text
Implement complete processing orchestration
```

Output:

``` text
Upload → Extract/OCR → Normalize → Summarize → Persist
```

------------------------------------------------------------------------

## Agent Task 12

``` text
Build frontend product flow
```

Output:

``` text
Upload
Summary selection
Processing state
Polling
Results
Errors
```

------------------------------------------------------------------------

## Agent Task 13

``` text
Reliability hardening
```

Output:

``` text
Retry classification
Idempotency
Failure handling
Observability
```

------------------------------------------------------------------------

## Agent Task 14

``` text
Testing, evaluation, and submission readiness
```

Output:

``` text
Unit tests
Integration tests
E2E smoke tests
AI evaluation cases
Production build
README verification
```

------------------------------------------------------------------------

# 38. Final Quality Checklist

Before the project is considered complete, verify all of the following.

## Functional

-   [ ] User can upload a supported document.
-   [ ] Invalid files are rejected.
-   [ ] File is stored successfully.
-   [ ] Document processing state is visible.
-   [ ] Digital PDF uses native extraction where possible.
-   [ ] Scanned/image input can use OCR.
-   [ ] Empty/unusable extraction fails meaningfully.
-   [ ] Short summary works.
-   [ ] Medium summary works.
-   [ ] Long summary works.
-   [ ] Large documents use the chunked strategy when required.
-   [ ] AI output is schema-validated.
-   [ ] Completed summaries persist.
-   [ ] Refresh does not lose completed results.
-   [ ] Failure state is visible to the user.

## Architecture

-   [ ] No premature microservices.
-   [ ] Provider boundaries are respected.
-   [ ] AI secrets are server-side.
-   [ ] File binaries are not stored in PostgreSQL by default.
-   [ ] Processing state is durable.
-   [ ] API responses follow documented contracts.
-   [ ] Expensive processing is not accidentally buried inside UI logic.
-   [ ] External provider details do not unnecessarily leak through
    public APIs.

## Quality

-   [ ] Type checking passes.
-   [ ] Linting passes.
-   [ ] Production build passes.
-   [ ] Relevant tests pass.
-   [ ] Major error paths tested.
-   [ ] Large-document path tested.
-   [ ] OCR path tested.
-   [ ] API contracts manually verified.
-   [ ] No secrets committed.
-   [ ] Environment variables documented.

## Submission

-   [ ] Assignment requirements are demonstrably covered.
-   [ ] README explains setup.
-   [ ] README explains architecture at an appropriate level.
-   [ ] README documents assumptions and limitations.
-   [ ] Demo flow is stable.
-   [ ] Known limitations are honest.
-   [ ] The architecture can be explained clearly in an interview.

------------------------------------------------------------------------

# 39. What Must Not Be Missed

The most common failure mode in this project would be building an
attractive upload interface and a basic AI call while ignoring the real
engineering problem.

The implementation must explicitly handle:

``` text
Digital PDFs
Scanned PDFs / image documents
Extraction failure
Large documents
AI output validation
Processing states
Duplicate work
External provider failure
Page refresh after completion
Durable persistence
Server-side security boundaries
```

These are not optional polish items.

They are part of the core engineering design.

------------------------------------------------------------------------

# 40. Final Execution Principle

The project should be built in this order:

> **Correctness → Reliability → Product Experience → Performance →
> Scale**

Not:

> **Fancy infrastructure → Complex architecture → Difficult debugging**

The final implementation should demonstrate that the system was designed
by asking:

-   What can fail?
-   Where does data live?
-   What happens when a document is too large?
-   What happens when native extraction does not work?
-   What happens when the AI provider returns malformed output?
-   What state does the user see while work is happening?
-   What happens when the page refreshes?
-   How can expensive work scale later?

If the implementation can answer those questions clearly, it will stand
out substantially from a basic "upload PDF → send text to LLM → show
summary" submission.

------------------------------------------------------------------------

**End of IMPLEMENTATION_PLAN.md**
