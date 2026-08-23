# PROJECT CONTEXT --- Document Summary Assistant

> **Document Status:** Living Source of Truth\
> **Version:** 1.0\
> **Purpose:** Provide complete, concise project context for humans and
> AI agents. This document defines what is being built, why, the current
> scope, architectural principles, decisions, constraints, and
> guardrails.

------------------------------------------------------------------------

## 1. Project Identity

### Project Name

**Document Summary Assistant**

### Immediate Goal

Build a polished, working technical-assessment application that
demonstrates strong software engineering, thoughtful architecture,
reliable document processing, practical AI integration, clean UI/UX, and
production-minded scalability without unnecessary overengineering.

### Product Direction

The MVP is a **Document Summary Assistant**. Its architecture should
form a foundation for a future **Document Intelligence Platform**,
without implementing future features prematurely.

Potential future extensions include document chat, semantic search,
multi-document summarization, citations, document comparison,
specialized summaries, team workspaces, APIs, and enterprise processing.

------------------------------------------------------------------------

## 2. Assignment Requirements

The application must support:

### Document Upload

-   PDF files
-   Image files, including scanned documents
-   Drag-and-drop and/or file picker

### Text Extraction

-   Extract text from PDFs
-   Use OCR for images and scanned documents
-   Preserve useful formatting/structure as much as practical

### Summary Generation

-   Automatically generate smart summaries
-   Support:
    -   Short
    -   Medium
    -   Long
-   Highlight key points
-   Capture main ideas and essential information

### UI/UX

-   Simple and intuitive interface
-   Clear upload and result experience
-   Mobile responsiveness
-   Loading states
-   Basic error handling

### Delivery

-   Working hosted application
-   GitHub repository
-   README
-   Brief explanation of the approach

### Evaluation Priorities

1.  Problem-solving approach
2.  Code quality
3.  Working functionality
4.  Documentation

------------------------------------------------------------------------

## 3. Product Problem

Users may have long PDFs, scanned documents, images containing text,
reports, research papers, or technical documents that take time to
understand.

The system should allow a user to upload a document and quickly answer:

-   What is this document about?
-   What are its most important points?
-   What are the main ideas?
-   How much detail should the summary contain?

The document-processing complexity should remain internal. The user
experience should remain simple.

------------------------------------------------------------------------

## 4. Primary User Journey

``` text
User
  |
  v
Upload PDF or Image
  |
  v
Validate File
  |
  v
Register / Store Document
  |
  v
Classify Document
  |
  +--> Native PDF text available?
  |          |
  |        Yes -> Native Extraction
  |
  +--> Image / Scanned PDF / Insufficient Text
             |
             v
            OCR
             |
             v
      Normalize Extracted Content
             |
             v
      Determine Processing Strategy
             |
      +------+------+
      |             |
      v             v
 Small Document   Large Document
      |             |
      v             v
 Direct AI       Chunked / Hierarchical
 Summary         Summarization
      |             |
      +------+------+
             |
             v
    Structured Summary Result
             |
             v
      Display to the User
```

The user should see meaningful progress rather than an unexplained
indefinite loading state.

------------------------------------------------------------------------

## 5. MVP Scope

### In Scope

-   PDF upload
-   Image upload
-   Drag-and-drop or file picker
-   File validation
-   PDF text extraction
-   OCR for images/scanned documents
-   Short, medium, and long summaries
-   Key points
-   Main ideas
-   Loading/progress states
-   Error states
-   Responsive UI
-   Deployment
-   Clean documentation

### Explicitly Out of Scope

Unless explicitly requested, do not implement:

-   Enterprise authentication
-   Multi-tenancy
-   Billing
-   Kubernetes
-   Complex microservice orchestration
-   Multiple AI providers in the first implementation
-   Vector databases
-   Embeddings
-   Document chat
-   Semantic search
-   Webhooks
-   Team collaboration
-   Complex RBAC
-   Advanced analytics
-   Full distributed tracing

The architecture may support future evolution toward these features, but
the MVP must remain focused.

------------------------------------------------------------------------

## 6. Core Architectural Principles

### 6.1 Build for the MVP, Design for Evolution

Implement only what is required to deliver a strong working product,
while keeping important boundaries clean enough to evolve later.

### 6.2 Avoid Blocking Long-Running Work

OCR, extraction, and LLM inference can take significantly longer than
ordinary API operations. Request acceptance, processing, and result
delivery should be conceptually separable.

### 6.3 Use Intelligent Routing

Not every document should follow the same path:

``` text
Digital PDF -> Native text extraction
Scanned PDF with insufficient text -> OCR
Image -> OCR
```

OCR must not be used unnecessarily.

### 6.4 Preserve Useful Structure

Prefer structured or semi-structured content over flattening everything
into one unorganized string. Preserve headings, sections, paragraphs,
page boundaries, and reading order where practical.

### 6.5 Validate Structured AI Output

AI responses used by the application must be predictable and validated.

Example target shape:

``` json
{
  "title": "Document title",
  "summary": "Requested summary",
  "keyPoints": ["Point 1", "Point 2"],
  "mainIdeas": ["Idea 1", "Idea 2"]
}
```

### 6.6 Use Size-Aware Summarization

Small documents may use direct summarization. Large documents should use
chunking and hierarchical summarization:

``` text
Large Document
      |
      v
Structure-aware Chunking
      |
      +--> Chunk 1 -> Partial Summary
      +--> Chunk 2 -> Partial Summary
      +--> Chunk N -> Partial Summary
      |
      v
Aggregation / Reduction
      |
      v
Final Structured Summary
```

### 6.7 Optimize Realistically

Microsecond or millisecond completion is not realistic for full OCR and
LLM inference. Performance should instead come from fast validation,
fast upload acknowledgement, intelligent routing, appropriate
asynchronous processing, caching, and avoiding repeated work.

### 6.8 Avoid Unnecessary Infrastructure

Every dependency or service must justify its existence. Prefer the
simplest architecture that satisfies the MVP without closing off
reasonable future evolution.

------------------------------------------------------------------------

## 7. Target Logical Architecture

``` text
                        +----------------------+
                        |     Next.js App      |
                        | Upload + Results UI  |
                        +----------+-----------+
                                   |
                                   v
                        +----------------------+
                        | Application / API    |
                        | Validation           |
                        | Orchestration        |
                        +-----+-----------+----+
                              |           |
                              v           v
                       +----------+   +-----------+
                       | Storage  |   | PostgreSQL|
                       +----+-----+   +-----------+
                            |
                            v
                     +-------------+
                     | Processing  |
                     | Pipeline    |
                     +------+------+
                            |
                +-----------+-----------+
                |                       |
                v                       v
        Native Text Extraction         OCR
                |                       |
                +-----------+-----------+
                            |
                            v
                  Normalized Document
                            |
                            v
                  Summarization Strategy
                            |
                   +--------+--------+
                   |                 |
                   v                 v
                Direct         Hierarchical
                 AI             Summarization
                   |                 |
                   +--------+--------+
                            |
                            v
                    Structured Result
                            |
                            v
                         Next.js UI
```

This is a logical architecture. The MVP does not require every logical
component to be deployed as a separate service.

------------------------------------------------------------------------

## 8. Technology Direction

### Locked

-   Frontend: Next.js, React, TypeScript
-   Styling direction: Tailwind CSS
-   Database direction: PostgreSQL
-   Input support: PDF and images
-   OCR principle: only when required
-   Large-document principle: size-aware/chunk-aware summarization
-   AI output: structured and validated
-   Architecture philosophy: MVP simplicity with scalable boundaries

### Preferred / Proposed

-   UI components: shadcn/ui
-   ORM: Prisma
-   Initial AI provider: Gemini
-   Product-grade document processing direction: Docling
-   Processing language: Python where document/OCR tooling makes it
    beneficial
-   Scaled queue direction: Redis + BullMQ
-   Product storage direction: S3-compatible object storage such as
    Cloudflare R2 or Amazon S3

### Open Decisions

-   Exact MVP deployment topology
-   Exact MVP storage provider
-   Whether the first implementation uses a durable queue
-   Exact extraction library/service arrangement
-   Exact OCR backend
-   File size limits
-   Supported image formats
-   Direct upload versus server-mediated upload
-   Authentication requirements
-   Exact database schema
-   Exact API contracts
-   Large-document thresholds
-   Exact summary length targets
-   File retention/deletion policy

Preferred decisions must not be treated as permanently locked until
explicitly approved.

------------------------------------------------------------------------

## 9. MVP vs Future Product

  -------------------------------------------------------------------------
  Area                    MVP                     Future Direction
  ----------------------- ----------------------- -------------------------
  Frontend                Next.js                 Next.js

  API                     Next.js application     Dedicated/scalable API
                          layer                   boundary if justified

  Database                PostgreSQL              PostgreSQL with optimized
                                                  scaling

  Storage                 Deployment-friendly     S3-compatible object
                          object storage          storage

  Processing              Simplified              Horizontally scalable
                          pipeline/worker         stateless workers

  OCR                     Required support        Optimized routing and
                                                  scalable workers

  AI                      One provider            Provider abstraction and
                                                  fallback

  Large documents         Practical chunking when Full hierarchical
                          needed                  orchestration

  Queue                   Optional based on need  Durable queue with
                                                  retries

  Caching                 Minimal/targeted        Content-addressable
                                                  caching

  Auth                    Not required unless     Multi-user/multi-tenant
                          requested               

  Search/chat             Out of scope            Future extension
  -------------------------------------------------------------------------

------------------------------------------------------------------------

## 10. Document Processing Pipeline

### Stage 1 --- Upload

Responsibilities: - Validate file type - Validate file size - Assign a
document identifier - Store/register the original file - Reject invalid
or unsupported files safely

### Stage 2 --- Classification

Determine: - File type - Whether a PDF contains meaningful native text -
Whether OCR is required

``` text
PDF
 |
 +--> Native text check
         |
         +--> Meaningful text -> Native extraction
         |
         +--> Insufficient/no text -> OCR

Image -> OCR
```

### Stage 3 --- Extraction

Produce usable content while retaining useful structure where practical.

Keep a conceptual distinction between: - Original file - Extracted
content - Normalized content

### Stage 4 --- Normalization

Possible responsibilities: - Remove extraction artifacts - Normalize
whitespace - Preserve section boundaries - Retain page/section metadata
where useful - Remove obviously empty content

### Stage 5 --- Strategy Selection

``` text
Normalized Content
       |
       v
Estimate Size / Tokens
       |
       +--> Small -> Direct Summary
       |
       +--> Large -> Chunk + Partial Summaries + Final Reduction
```

### Stage 6 --- AI Summarization

Required output: - Summary - Key points - Main ideas

Supported lengths: - Short - Medium - Long

### Stage 7 --- Validation and Persistence

Validate AI output against the expected schema before marking processing
as successful.

Useful metadata may include: - Document ID - Summary length - Processing
status - Creation time - Model/version metadata

------------------------------------------------------------------------

## 11. Processing States

Conceptual state model:

``` text
UPLOADING
    |
    v
UPLOADED
    |
    v
PROCESSING
    |
    +--> EXTRACTING
    |
    +--> OCR_PROCESSING
    |
    +--> NORMALIZING
    |
    +--> SUMMARIZING
    |
    v
COMPLETED
```

Failure state:

``` text
FAILED
```

The final implementation may simplify state names, but progress must
remain understandable and reliable.

------------------------------------------------------------------------

## 12. AI Architecture

### Provider Boundary

Business logic should conceptually depend on a summarization capability
rather than deeply coupling every layer to one vendor.

``` text
Summarization Service
        |
        v
AI Provider Boundary
        |
        +--> Gemini (initial)
        |
        +--> Future provider if needed
```

Only one provider needs to be implemented for the MVP.

### Prompting Principles

Prompts should: - Clearly define the task - Specify summary length -
Ground output in supplied content - Request structured output - Avoid
invented information - Handle missing or unclear information
appropriately

### Summary Lengths

-   **Short:** concise overview
-   **Medium:** balanced summary with context
-   **Long:** detailed summary preserving more context

Use configuration-driven behavior rather than separate unrelated
summarization systems.

------------------------------------------------------------------------

## 13. Performance Strategy

### Lightweight Operations

Should be fast: - File validation - Metadata creation - Status lookup -
Cached-result lookup

### Expensive Operations

May take seconds or longer: - OCR - Large document extraction -
Chunking - LLM inference

The architecture should make expensive operations visible to users and
separable from ordinary request handling.

### Future Caching Direction

A future implementation may use a deterministic file hash, such as
SHA-256, to support: - Duplicate detection - Reuse of extracted
content - Reuse of summaries - Lower OCR/AI cost

Do not implement this prematurely if it compromises the MVP.

------------------------------------------------------------------------

## 14. Reliability and Error Handling

The system should handle: - Unsupported file type - Oversized file -
Corrupted/unreadable PDF - OCR failure - Empty extracted content - AI
provider failure - Invalid AI response - Storage/network failure

User-facing errors must be understandable. Internal errors should
preserve diagnostic context without exposing sensitive implementation
details.

------------------------------------------------------------------------

## 15. Security Baseline

The MVP should: - Validate file type and size - Avoid executing uploaded
content - Store secrets in environment variables - Never expose AI API
keys to the browser - Validate server-side inputs - Avoid trusting
client-provided metadata - Prefer private object access for sensitive
documents - Define a retention approach once storage is finalized

Future product concerns include malware scanning, tenant isolation,
encryption policies, audit logs, PII handling, compliance, and data
deletion controls. These are not automatically MVP requirements.

------------------------------------------------------------------------

## 16. Observability

Useful metadata: - Document ID - Processing stage - Error category -
Processing duration - AI provider/model metadata where useful

Avoid logging full document content unnecessarily.

------------------------------------------------------------------------

## 17. UX Principles

The UI should feel like a focused document product, not merely an AI
demo.

### Upload

The user should understand: - Supported file types - How to upload -
Whether upload succeeded - What happens next

### Processing

Prefer meaningful stages such as: - Document uploaded - Extracting
content - Reading scanned pages - Generating summary - Preparing
insights - Complete

### Results

Clearly display: - Summary - Selected summary length - Key points - Main
ideas - Useful error/retry options where applicable

The experience must remain responsive on desktop and mobile.

------------------------------------------------------------------------

## 18. AI Agent Development Rules

Every AI agent must treat this document as primary project context.

Before implementation: 1. Read this document. 2. Identify requested
scope. 3. Read relevant architecture/API documentation when available.
4. Inspect existing implementation before creating new abstractions. 5.
Preserve existing contracts unless explicitly changing them.

Agents must not: - Introduce unapproved major technologies - Build
out-of-scope enterprise features - Duplicate existing functionality -
Silently replace architecture - Invent undocumented requirements -
Refactor unrelated areas without reason - Change public contracts
without considering consumers

If requirements or implementation conflict: 1. Do not silently guess. 2.
Identify the conflict. 3. Prefer the latest explicitly approved
decision. 4. Update documentation when an intentional architectural
decision changes.

------------------------------------------------------------------------

## 19. Decision Status

### Locked

  Area                 Decision
  -------------------- -----------------------------------------
  Product              Document Summary Assistant
  Frontend             Next.js + React + TypeScript
  Styling              Tailwind CSS
  Database direction   PostgreSQL
  Input                PDF + image
  OCR principle        Conditional; only when required
  Large documents      Size-aware/chunk-aware strategy
  AI output            Structured and validated
  Architecture         MVP simplicity with scalable boundaries

### Preferred / Proposed

  Area                  Current Direction
  --------------------- -------------------------------
  ORM                   Prisma
  AI provider           Gemini
  Document processing   Docling
  Processing language   Python where beneficial
  Scaled queue          Redis + BullMQ
  Product storage       Cloudflare R2 / S3-compatible
  UI components         shadcn/ui

### Open

-   Deployment topology
-   MVP storage provider
-   Queue requirement in first version
-   Exact extraction/OCR implementation
-   File limits and supported image formats
-   Upload mechanism
-   Authentication
-   Database schema
-   API contracts
-   Chunking thresholds
-   Summary targets
-   Retention policy

------------------------------------------------------------------------

## 20. Success Criteria

A successful MVP allows a user to:

1.  Open the deployed application.
2.  Upload a valid PDF or image.
3.  Receive clear validation feedback.
4.  Have content extracted.
5.  Use OCR when required.
6.  Receive short, medium, or long summaries.
7.  Receive a summary grounded in the document.
8.  See key points and main ideas.
9.  Understand processing progress.
10. Receive useful errors on failure.
11. Use the application on desktop and mobile.

Engineering success additionally requires: - Clean TypeScript - Clear
separation of responsibilities - Validated inputs and AI outputs - No
exposed secrets - Reasonable error handling - Documentation consistent
with implementation - A working deployment - A repository understandable
by another engineer or AI agent

------------------------------------------------------------------------

## 21. Non-Negotiable Guardrails

1.  Do not overengineer the assessment.
2.  Do not sacrifice working functionality for theoretical architecture.
3.  Do not OCR documents with sufficient native text.
4.  Do not blindly send arbitrarily large documents as one uncontrolled
    AI request.
5.  Do not trust raw AI output without validation.
6.  Do not expose secrets to the client.
7.  Do not let agents silently introduce major dependencies or
    architecture changes.
8.  Do not build future features unless explicitly requested.
9.  Keep the architecture explainable in an interview.
10. When simplicity and complexity both satisfy the MVP, prefer
    simplicity.

------------------------------------------------------------------------

## 22. Current Implementation Direction

``` text
1. Finalize architecture decisions
        |
        v
2. Create repository foundation
        |
        v
3. Define API and data contracts
        |
        v
4. Implement upload and document lifecycle
        |
        v
5. Implement extraction and OCR routing
        |
        v
6. Implement AI summarization
        |
        v
7. Build polished frontend
        |
        v
8. Integrate end-to-end
        |
        v
9. Test failures and edge cases
        |
        v
10. Deploy and document
```

------------------------------------------------------------------------

## 23. Context Update Rules

This is a living source of truth.

When a major decision changes: - Update the relevant section. - Change
its decision status. - Remove or mark superseded assumptions. - Do not
keep contradictory instructions active.

Do not create unofficial architecture documents that conflict with this
file.

------------------------------------------------------------------------

## 24. Final Project Positioning

This is **not merely an upload form connected to an LLM**.

It is a focused Document Summary Assistant built around:

``` text
Upload
  ->
Intelligent File Classification
  ->
Native Extraction or OCR
  ->
Content Normalization
  ->
Size-Aware Summarization Strategy
  ->
Structured AI Output
  ->
Clear User Experience
```

The implementation must remain practical enough for the technical
assessment while demonstrating engineering thinking capable of evolving
into a scalable document intelligence product.

------------------------------------------------------------------------

**End of Project Context**
