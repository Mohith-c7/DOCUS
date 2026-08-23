# SYSTEM ARCHITECTURE --- Document Summary Assistant

> **Document Status:** Architecture Source of Truth\
> **Version:** 1.0\
> **Depends On:** `PROJECT_CONTEXT.md`\
> **Purpose:** Define how the Document Summary Assistant is structured,
> how data and processing move through the system, which components own
> which responsibilities, and how the MVP can evolve into a scalable
> Document Intelligence product.

------------------------------------------------------------------------

# 1. Architecture Goals

The system must satisfy two goals simultaneously:

1.  Deliver a strong, working technical-assessment MVP.
2.  Demonstrate an architecture that can evolve into a scalable product
    without requiring a complete rewrite.

The architecture therefore follows this principle:

> **Start as a modular application, scale by extracting independently
> scalable workloads only when the workload justifies it.**

The project must **not** begin as a collection of microservices.

The initial architecture should instead establish clean logical
boundaries:

``` text
Presentation
      |
Application / API
      |
Domain Services
      |
Infrastructure / Providers
      |
External Systems
```

These boundaries make future extraction possible without forcing
distributed-system complexity into the MVP.

------------------------------------------------------------------------

# 2. Architecture Overview

## 2.1 MVP Logical Architecture

``` text
                         USER
                           |
                           v
                +---------------------+
                |    Next.js App      |
                |                     |
                | Upload UI           |
                | Processing UI       |
                | Summary UI          |
                +----------+----------+
                           |
                           v
                +---------------------+
                | Application Layer   |
                |                     |
                | API Routes /        |
                | Server Actions*     |
                | Validation          |
                | Orchestration       |
                +----+-----------+----+
                     |           |
                     v           v
              +----------+  +-----------+
              |PostgreSQL|  |Object     |
              |          |  |Storage    |
              +----+-----+  +-----+-----+
                   |              |
                   |              |
                   +------+-------+
                          |
                          v
                +---------------------+
                | Document Processing |
                |                     |
                | Classification      |
                | Text Extraction     |
                | OCR Routing         |
                | Normalization       |
                +----------+----------+
                           |
                           v
                +---------------------+
                | Summarization       |
                |                     |
                | Size Strategy       |
                | Chunking            |
                | AI Provider         |
                | Output Validation   |
                +----------+----------+
                           |
                           v
                     Summary Result
                           |
                           v
                        PostgreSQL
                           |
                           v
                        Next.js UI
```

`*` The final MVP may use route handlers, server actions, or a
combination. The choice should follow API needs and deployment
constraints.

------------------------------------------------------------------------

# 3. Architectural Style

The recommended initial style is:

## Modular Monolith + External Processing Capability

The application starts as one deployable product with internal modules.

``` text
document-summary-assistant
|
+-- web/application
|     +-- documents
|     +-- summaries
|     +-- processing
|
+-- domain/services
|     +-- document-service
|     +-- extraction-service
|     +-- summarization-service
|
+-- infrastructure
|     +-- database
|     +-- storage
|     +-- ai-provider
|     +-- extraction-provider
```

The important distinction is:

> **One deployment unit does not mean one giant codebase with no
> boundaries.**

The system should remain modular internally.

Future workloads that become independently scalable can be extracted
later:

``` text
                 Future Architecture

                +----------------+
                | Next.js Web    |
                +-------+--------+
                        |
                        v
                  API / Backend
                        |
          +-------------+-------------+
          |                           |
          v                           v
    PostgreSQL                    Job Queue
                                      |
                       +--------------+--------------+
                       |                             |
                       v                             v
              Document Workers                  AI Workers
                       |                             |
                       +--------------+--------------+
                                      |
                                      v
                                Object Storage
```

------------------------------------------------------------------------

# 4. Component Responsibilities

## 4.1 Next.js Frontend

The frontend is responsible for:

-   Upload interaction
-   File selection
-   Client-side preliminary validation
-   Summary length selection
-   Processing progress display
-   Polling or receiving processing status
-   Displaying summaries
-   Displaying key points and main ideas
-   Error presentation
-   Responsive UI

The frontend must **not**:

-   Contain AI API keys
-   Directly call privileged AI providers using secrets
-   Perform expensive OCR
-   Contain business-critical document processing logic

------------------------------------------------------------------------

## 4.2 Application / API Layer

The application layer is responsible for:

-   Request validation
-   Authentication in future versions
-   Document lifecycle orchestration
-   Database interaction
-   Storage coordination
-   Processing initiation
-   Status retrieval
-   Summary retrieval
-   Error mapping

It should remain relatively thin.

The application layer should orchestrate domain services rather than
contain all extraction and AI logic directly.

------------------------------------------------------------------------

## 4.3 Document Domain

This module owns:

-   Document creation
-   Metadata
-   Processing lifecycle
-   Processing status
-   Document identity
-   Summary relationships

It should not know the internal details of a specific OCR engine or LLM
provider.

------------------------------------------------------------------------

## 4.4 Extraction Domain

This module owns:

-   Document classification
-   Native text extraction
-   OCR routing
-   Extracted-content normalization

Conceptually:

``` text
Document
   |
   v
DocumentClassifier
   |
   +--> NativeTextExtractor
   |
   +--> OCRProcessor
            |
            v
      NormalizedDocument
```

------------------------------------------------------------------------

## 4.5 Summarization Domain

This module owns:

-   Summary configuration
-   Document size strategy
-   Chunking
-   Partial summarization
-   Final aggregation
-   Structured result validation

It should not directly depend on UI concerns.

------------------------------------------------------------------------

## 4.6 Infrastructure Layer

This layer provides implementations for external capabilities.

Examples:

``` text
StorageProvider
    -> Cloudflare R2
    -> Amazon S3

AIProvider
    -> Gemini

ExtractionProvider
    -> Native PDF library
    -> Docling

OCRProvider
    -> Selected OCR engine
```

Application/domain logic should depend on the capability, not
unnecessarily on vendor-specific details.

------------------------------------------------------------------------

# 5. Document Lifecycle

The document is the central entity of the system.

Its lifecycle conceptually looks like:

``` text
CLIENT
   |
   v
VALIDATED
   |
   v
UPLOADED
   |
   v
PROCESSING
   |
   +--> EXTRACTING
   |
   +--> OCR_PROCESSING (if required)
   |
   +--> NORMALIZING
   |
   +--> SUMMARIZING
   |
   v
COMPLETED

Any stage
   |
   v
FAILED
```

The database should store a durable representation of the current state.

The frontend should never need to infer processing state from arbitrary
text.

------------------------------------------------------------------------

# 6. Upload Architecture

## 6.1 Upload Flow

The conceptual upload flow is:

``` text
User
 |
 v
Select File
 |
 v
Client Validation
 |
 v
Server Validation
 |
 v
Create Document Record
 |
 +------------------------+
 |                        |
 v                        v
Direct Upload*       Server Upload*
 |
 v
Object Storage
 |
 v
Update Document Metadata
 |
 v
Start Processing
```

The final MVP may use either direct upload or server-mediated upload.

## 6.2 Recommended Product Direction: Direct-to-Object Storage

For a scalable product:

``` text
Browser
   |
   | Request upload authorization
   v
Application API
   |
   | Signed upload URL
   v
Browser
   |
   | Upload file directly
   v
Object Storage
   |
   v
Notify / confirm API
```

Benefits:

-   Large files do not consume application server bandwidth
-   Easier horizontal scaling
-   Storage is decoupled from compute
-   Upload infrastructure can scale independently

For the MVP, server-mediated upload may be simpler if deployment
constraints make direct uploads unnecessarily complex.

------------------------------------------------------------------------

# 7. Storage Architecture

The architecture separates:

## Object Storage

Used for:

-   Original uploaded files
-   Potential future rendered pages
-   Intermediate artifacts when justified

## PostgreSQL

Used for:

-   Document metadata
-   Processing state
-   Extracted-content metadata
-   Summary records
-   Processing errors/diagnostics as appropriate

The database should not be the default location for large binary files.

Conceptually:

``` text
Object Storage
   |
   | fileKey / object reference
   v
PostgreSQL Document Record
```

------------------------------------------------------------------------

# 8. Document Classification and Extraction

## 8.1 Why Classification Exists

A document may be:

1.  A digital PDF with embedded text.
2.  A scanned PDF containing page images.
3.  An image containing text.
4.  A partially extractable document.

These should not automatically receive the same processing.

------------------------------------------------------------------------

## 8.2 Routing Strategy

``` text
                    Input Document
                          |
                          v
                   Detect File Type
                          |
             +------------+------------+
             |                         |
             v                         v
           Image                       PDF
             |                         |
             v                         v
            OCR              Attempt Native Extraction
                                       |
                          +------------+------------+
                          |                         |
                          v                         v
                    Usable Text              Insufficient Text
                          |                         |
                          v                         v
                   Normalize Content              OCR
                          |                         |
                          +------------+------------+
                                       |
                                       v
                               Normalized Document
```

The implementation should define measurable criteria for "usable text."

Possible signals:

-   Extracted character count
-   Non-whitespace character ratio
-   Text density relative to page count
-   Extraction failure indicators

The exact threshold remains an implementation decision and must be
tested against representative files.

------------------------------------------------------------------------

# 9. Extraction Strategy

## 9.1 Native PDF Extraction

Native extraction should be preferred when meaningful text is available
because it is generally:

-   Faster
-   Less expensive
-   Less error-prone than OCR
-   Better at preserving digital text

The selected extraction tool should expose enough structure for future
evolution where practical.

------------------------------------------------------------------------

## 9.2 OCR

OCR is required for:

-   Image uploads
-   Scanned PDFs
-   PDFs with insufficient usable native text

The OCR subsystem should be conceptually replaceable.

``` text
OCRService
    |
    +--> OCR Provider / Engine
```

The initial implementation should choose one reliable OCR approach
rather than implementing several alternatives.

------------------------------------------------------------------------

# 10. Content Normalization

Extraction tools may produce:

-   Extra whitespace
-   Broken lines
-   Empty sections
-   Repeated artifacts
-   Inconsistent formatting

Normalization converts raw extraction output into content suitable for
AI processing.

Conceptual structure:

``` text
Raw Extraction
      |
      v
Cleanup
      |
      v
Structure Preservation
      |
      v
Normalized Sections
      |
      v
AI-ready Content
```

A future model may represent content as:

``` text
Document
  -> Pages
      -> Sections
          -> Blocks
              -> Text
```

The MVP should avoid creating a complicated document AST unless the
chosen processing library already provides useful structure.

------------------------------------------------------------------------

# 11. Summarization Architecture

The summarization pipeline is one of the main differentiators of the
system.

``` text
Normalized Content
        |
        v
Estimate Input Size
        |
        +-------------------------+
        |                         |
        v                         v
   Within Threshold          Above Threshold
        |                         |
        v                         v
  Direct Summary         Structure-Aware Chunking
                                  |
                                  v
                         Partial Summaries
                                  |
                                  v
                           Final Aggregation
                                  |
                                  v
                         Structured Validation
                                  |
                                  v
                             Final Result
```

------------------------------------------------------------------------

# 12. Small Document Strategy

For a document that fits safely within the configured model/input
strategy:

``` text
Normalized Content
       |
       +--> Summary Configuration
       |
       v
Summarization Prompt
       |
       v
AI Provider
       |
       v
Structured Response
       |
       v
Zod Validation
       |
       v
Persist Result
```

The summary configuration should contain at least:

``` text
SHORT
MEDIUM
LONG
```

The implementation should not maintain three unrelated AI pipelines.

Instead:

``` text
SummaryRequest {
    length: SHORT | MEDIUM | LONG
}
```

should influence the summarization strategy and output constraints.

------------------------------------------------------------------------

# 13. Large Document Strategy

Large documents require controlled processing.

## 13.1 Structure-Aware Chunking

Do not chunk blindly by arbitrary character positions if meaningful
structure is available.

Preferred priority:

``` text
Section boundary
    ->
Paragraph boundary
    ->
Sentence boundary
    ->
Hard size limit
```

This reduces the probability of cutting important context in the middle
of a sentence or logical section.

------------------------------------------------------------------------

## 13.2 Map Stage

Each chunk receives a summarization task.

``` text
Document
 |
 +--> Chunk 1 -> Summary 1
 |
 +--> Chunk 2 -> Summary 2
 |
 +--> Chunk 3 -> Summary 3
 |
 +--> Chunk N -> Summary N
```

Where safe and beneficial, chunk processing may run concurrently.

Concurrency must remain configurable to avoid provider rate limits.

------------------------------------------------------------------------

## 13.3 Reduce Stage

Partial summaries are combined:

``` text
Summary 1
Summary 2
Summary 3
    |
    v
Aggregation Prompt
    |
    v
Final Summary
```

If the intermediate aggregation is still too large, additional
hierarchical levels may be used:

``` text
Chunks
   |
   v
Level 1 Summaries
   |
   v
Level 2 Summaries
   |
   v
Final Summary
```

The MVP should implement only the complexity required by realistic
assignment documents.

------------------------------------------------------------------------

# 14. AI Provider Architecture

The application should conceptually expose an interface such as:

``` text
SummarizationProvider
    |
    +--> summarize(request)
```

The request can include:

``` text
content
summaryLength
outputSchema
```

The provider returns a normalized provider result which is validated
before persistence.

This prevents provider-specific response handling from leaking
throughout the application.

The MVP may only implement one provider:

``` text
GeminiSummarizationProvider
```

A second provider should not be added without a clear requirement.

------------------------------------------------------------------------

# 15. Structured Output Validation

The target pipeline is:

``` text
AI Provider
     |
     v
Raw Provider Response
     |
     v
Parse / Normalize
     |
     v
Zod Schema Validation
     |
     +--> Valid -> Persist
     |
     +--> Invalid -> Controlled Failure / Retry Strategy
```

Example conceptual schema:

``` text
SummaryResult {
  title: string
  summary: string
  keyPoints: string[]
  mainIdeas: string[]
}
```

Validation protects the application from malformed provider responses.

------------------------------------------------------------------------

# 16. Processing Execution Model

There are two architecture levels.

## 16.1 MVP

The MVP may execute processing using a simplified model.

Possible approaches include:

### Option A --- Controlled synchronous processing

Suitable only when:

-   Documents are small
-   Deployment request limits are sufficient
-   The implementation remains reliable

### Option B --- Application-triggered background processing

The application creates a processing job and a worker/process handles it
outside the immediate request lifecycle.

This is the preferred direction if the chosen deployment environment
supports it cleanly.

------------------------------------------------------------------------

## 16.2 Scaled Product

The scaled architecture uses durable asynchronous processing:

``` text
Upload/API
    |
    v
Job Queue
    |
    v
+----------------------+
| Document Workers     |
|                      |
| Extraction           |
| OCR                  |
| Normalization        |
+----------+-----------+
           |
           v
+----------------------+
| AI / Summary Workers |
+----------+-----------+
           |
           v
      PostgreSQL
```

The queue can support:

-   Retry policies
-   Backoff
-   Concurrency limits
-   Durable job state
-   Worker scaling
-   Failure isolation

The preferred future direction is Redis-backed job processing such as
BullMQ when a Node.js queue architecture is appropriate.

The queue is **not automatically required for the MVP**.

------------------------------------------------------------------------

# 17. Retry and Failure Strategy

Retries should not be applied blindly.

## Potentially Retryable

-   Temporary AI provider failure
-   Temporary storage failure
-   Temporary network failure
-   Rate limiting

## Usually Non-Retryable

-   Unsupported file
-   Permanently corrupted file
-   Empty/invalid content after extraction
-   Invalid user input

Conceptually:

``` text
Processing Failure
       |
       v
Classify Failure
       |
       +--> Retryable
       |       |
       |       v
       |   Backoff + Retry
       |
       +--> Non-Retryable
               |
               v
             FAILED
```

Retry counts must be bounded.

------------------------------------------------------------------------

# 18. Caching and Duplicate Processing

Caching is not mandatory for the MVP, but the architecture should
support it.

A future product may use:

``` text
documentHash = SHA-256(file bytes)
```

Possible cache keys:

``` text
documentHash
documentHash + summaryLength
documentHash + processingVersion
```

This allows reuse of:

-   Extracted text
-   OCR results
-   Summaries

A processing version is important because extraction or summarization
logic may change.

Conceptually:

``` text
Cache Key
  =
Document Content Identity
  +
Requested Summary Configuration
  +
Processing Version
```

The MVP should only add caching where it provides real value.

------------------------------------------------------------------------

# 19. Database Role in the Architecture

PostgreSQL is the system of record for application metadata.

Conceptually:

``` text
Document
   |
   +--> file metadata
   +--> storage reference
   +--> processing state
   +--> timestamps

Processing
   |
   +--> current stage
   +--> error metadata
   +--> attempts

Summary
   |
   +--> summary length
   +--> structured result
   +--> provider/model metadata
```

The exact schema belongs in `API_AND_DATA.md`.

This architecture document defines responsibilities, not the final
database implementation.

------------------------------------------------------------------------

# 20. Status Delivery to the Frontend

For the MVP, the frontend can retrieve processing state using polling:

``` text
Frontend
   |
   +--> GET /documents/{id}/status
             |
             v
        PostgreSQL
```

Polling is simple and reliable for a technical assessment.

Future alternatives:

-   Server-Sent Events
-   WebSockets
-   Push/event infrastructure

These should not be implemented unless they solve a real requirement.

The architecture deliberately allows the status mechanism to evolve
independently from the document-processing domain.

------------------------------------------------------------------------

# 21. API Boundary

The API layer should expose stable resource-oriented capabilities.

Conceptual operations:

``` text
Create document
Upload/confirm document
Get document
Get processing status
Request summary
Get summary
```

The exact endpoints, request schemas, response schemas, and error
contracts belong in `API_AND_DATA.md`.

------------------------------------------------------------------------

# 22. Scalability Strategy

Scaling should follow workload characteristics.

## Frontend/API Scaling

Next.js application instances can scale horizontally when application
state is not stored locally.

Requirements:

-   No important processing state in process memory
-   Database as durable metadata source
-   Object storage for files
-   External provider calls isolated behind services

------------------------------------------------------------------------

## Processing Scaling

Document processing is independently scalable because workers can be
stateless.

``` text
Job Queue
   |
   +--> Worker 1
   +--> Worker 2
   +--> Worker N
```

Scaling factors include:

-   Queue depth
-   OCR workload
-   Document size
-   AI latency
-   Provider rate limits

Worker concurrency must be controlled rather than simply maximizing
parallel requests.

------------------------------------------------------------------------

## Database Scaling

Initial requirements:

-   Proper indexes
-   Connection management
-   Avoid unnecessary repeated reads
-   Store large binaries outside PostgreSQL

Future considerations:

-   Read replicas
-   Partitioning where justified
-   Connection pooling
-   Archival/retention policies

These are not MVP requirements.

------------------------------------------------------------------------

# 23. Performance Architecture

Performance should be optimized across the pipeline.

## Upload

-   Avoid routing large file bytes through unnecessary application
    layers when direct storage is appropriate.

## Extraction

-   Attempt native extraction before OCR when possible.
-   Avoid processing pages that do not require OCR where the chosen tool
    supports selective routing.

## AI

-   Avoid oversized requests.
-   Use controlled chunking.
-   Process chunks concurrently only within provider and system limits.
-   Reuse results when caching is justified.

## Result Delivery

-   Keep status and result reads lightweight.
-   Avoid recalculating completed summaries.

------------------------------------------------------------------------

# 24. Security Architecture

The architecture follows a minimum trust boundary:

``` text
Browser
   |
   | Untrusted input
   v
Validation Layer
   |
   v
Application / Domain
   |
   +--> Storage
   |
   +--> Database
   |
   +--> AI Provider
```

Requirements:

-   Server-side validation
-   File type/size restrictions
-   Environment-based secrets
-   No AI provider secrets in the client
-   Storage access controls
-   Sanitized user-facing errors

Future additions may include malware scanning and content-security
policies.

------------------------------------------------------------------------

# 25. Observability Architecture

Every processing request should be traceable through a document
identifier.

Conceptual logging:

``` text
Document ID
   |
   +--> Upload accepted
   +--> Extraction started
   +--> OCR selected/skipped
   +--> Summarization started
   +--> Completed / Failed
```

Useful measurements:

-   Upload duration
-   Extraction duration
-   OCR duration
-   AI duration
-   Total processing duration
-   Failure category

The MVP does not require enterprise observability tooling, but code
should make failures diagnosable.

------------------------------------------------------------------------

# 26. Deployment Architecture

## MVP Deployment

The exact providers remain open.

The architecture requires:

``` text
+------------------+
| Next.js App      |
+--------+---------+
         |
         +------------------+
         |                  |
         v                  v
   PostgreSQL         Object Storage
         |
         v
  Optional Processing
      Worker
```

The deployment choice must account for:

-   Serverless execution limits
-   OCR/extraction runtime requirements
-   Background processing support
-   Python runtime requirements if Docling or Python tooling is selected
-   Environment variables and secrets
-   Cost and simplicity

------------------------------------------------------------------------

## Scaled Deployment

``` text
                         Internet
                            |
                            v
                     CDN / Edge Layer
                            |
                            v
                      Next.js Frontend
                            |
                            v
                      API / Application
                       /       |       \
                      v        v        v
                 PostgreSQL   Queue   Object Storage
                               |
                     +---------+---------+
                     |                   |
                     v                   v
              Processing Workers      AI Workers
                     |
                     v
             Extraction / OCR
```

Components should scale independently only when workload requires it.

------------------------------------------------------------------------

# 27. Architecture Decision Rules

When evaluating a new technology or component, ask:

1.  What problem does it solve?
2.  Does the MVP currently have that problem?
3.  Can an existing component solve it cleanly?
4.  Does it create operational complexity?
5.  Can it be introduced later without a rewrite?

A component should not be added merely because it is popular or
considered "production grade."

------------------------------------------------------------------------

# 28. MVP Architecture Recommendation

The current recommended direction is:

``` text
Frontend
    Next.js + React + TypeScript
    Tailwind CSS + shadcn/ui

Application
    Next.js Route Handlers / server-side application layer
    Zod validation

Database
    PostgreSQL
    Prisma (preferred)

Storage
    S3-compatible object storage
    Provider selected based on deployment simplicity

Processing
    Start with the simplest reliable implementation
    Keep extraction/OCR behind provider boundaries

AI
    Gemini as the initial provider
    Structured output
    Zod validation

Large Documents
    Direct summarization when safe
    Hierarchical summarization when required

Status
    Database-backed state
    Frontend polling for MVP

Queue
    Not mandatory initially
    Redis + BullMQ as a future scaling direction
```

This recommendation intentionally avoids building microservices, Kafka,
Kubernetes, multiple AI providers, or a vector database for the
assessment.

------------------------------------------------------------------------

# 29. Future Evolution Path

The architecture can evolve in stages.

## Stage 1 --- Assessment MVP

``` text
Next.js
  |
  +--> PostgreSQL
  +--> Object Storage
  +--> Processing Module
  +--> AI Provider
```

## Stage 2 --- Reliable Background Processing

``` text
Next.js
   |
   +--> PostgreSQL
   +--> Object Storage
   +--> Job Queue
           |
           +--> Processing Worker
```

## Stage 3 --- Horizontal Processing Scale

``` text
Job Queue
   |
   +--> Worker 1
   +--> Worker 2
   +--> Worker N
```

## Stage 4 --- Product Intelligence

Potential additions:

-   Document chat
-   Retrieval
-   Embeddings
-   Vector storage
-   Multi-document analysis
-   Citations
-   Provider fallback
-   Teams/workspaces

These features are future possibilities, not current implementation
requirements.

------------------------------------------------------------------------

# 30. End-to-End Architecture Flow

The complete conceptual flow is:

``` text
1. User uploads a document
        |
        v
2. Validate type and size
        |
        v
3. Create document metadata
        |
        v
4. Store original file
        |
        v
5. Mark document ready for processing
        |
        v
6. Classify document
        |
        +--> Native extraction
        |
        +--> OCR when required
        |
        v
7. Normalize extracted content
        |
        v
8. Determine summarization strategy
        |
        +--> Direct summarization
        |
        +--> Hierarchical summarization
        |
        v
9. Validate structured AI result
        |
        v
10. Persist summary and processing metadata
        |
        v
11. Mark document COMPLETED
        |
        v
12. Frontend retrieves and displays result
```

------------------------------------------------------------------------

# 31. Non-Negotiable Architecture Guardrails

1.  Start as a modular system, not a premature microservice
    architecture.
2.  Keep files in object storage rather than using PostgreSQL as the
    default binary store.
3.  Prefer native extraction before OCR.
4.  OCR only when required.
5.  Preserve useful document structure.
6.  Do not send arbitrarily large content into one uncontrolled AI
    request.
7.  Validate structured AI output.
8.  Keep expensive processing conceptually separate from ordinary
    request handling.
9.  Persist processing state durably.
10. Do not expose provider secrets to the client.
11. Avoid adding infrastructure without a demonstrated need.
12. Keep every architectural decision explainable in an interview.

------------------------------------------------------------------------

# 32. Architecture Questions Still Open

The following decisions remain intentionally open and should be
finalized before implementation:

-   Exact storage provider
-   Exact deployment platform
-   Whether the MVP requires a dedicated worker
-   Exact extraction technology
-   Exact OCR engine/provider
-   Whether Python processing is a separate runtime/service
-   Exact upload flow
-   Exact API structure
-   File size limits
-   Chunking/token thresholds
-   AI model selection
-   Retry implementation

Once finalized, these decisions should be reflected in
`PROJECT_CONTEXT.md`, and relevant details should be documented in the
subsequent architecture/API documents.

------------------------------------------------------------------------

## Final Architecture Position

The system should be understood as:

> **A modular document-processing application with an intelligent
> routing pipeline that selects native extraction or OCR, normalizes
> document content, applies size-aware AI summarization, validates
> structured results, and can evolve from a focused Next.js MVP into
> independently scalable processing workers when real workload requires
> it.**

The architecture is intentionally ambitious in design but disciplined in
implementation.

**The differentiator is not the number of technologies used. The
differentiator is that every stage exists for a reason, every expensive
operation has an appropriate processing strategy, and the system can
explain how it scales without pretending that an assessment project
needs enterprise infrastructure on day one.**
