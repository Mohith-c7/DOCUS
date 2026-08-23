# API & DATA CONTRACTS --- Document Summary Assistant

> **Document Status:** Implementation Contract\
> **Version:** 1.0\
> **Depends On:** `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`\
> **Purpose:** Define the canonical data model, API contracts,
> request/response shapes, processing states, validation rules, and
> frontend-backend interaction rules for the Document Summary Assistant.

------------------------------------------------------------------------

# 1. Purpose and Scope

This document converts the project architecture into implementable
contracts.

It defines:

-   Core domain entities
-   Entity responsibilities and relationships
-   Processing states and transitions
-   API resource model
-   Request contracts
-   Response contracts
-   Validation requirements
-   Error contracts
-   Idempotency and retry considerations
-   Summary request behavior
-   Frontend-backend interaction rules
-   Data ownership
-   Contract versioning principles

This document does **not** finalize:

-   Physical database provider configuration
-   Deployment configuration
-   Exact storage provider
-   Exact OCR provider
-   Exact AI model
-   UI component implementation

Those decisions belong to architecture or implementation configuration.

------------------------------------------------------------------------

# 2. Contract Principles

All APIs and data contracts must follow these rules.

## 2.1 Server Is the Source of Truth

The client may display optimistic state where useful, but authoritative
state comes from the server.

The client must not independently infer:

-   Whether processing succeeded
-   Whether OCR was required
-   Whether a summary is valid
-   Whether a document is complete

------------------------------------------------------------------------

## 2.2 Stable External Shapes

Internal implementation details may change.

For example:

``` text
Gemini -> another AI provider
pdf extraction library -> another extraction library
R2 -> S3
```

These changes should not unnecessarily change public API response
shapes.

------------------------------------------------------------------------

## 2.3 Explicit Status

Do not encode processing state inside arbitrary messages.

Bad:

``` json
{
  "message": "Still working on your document..."
}
```

Preferred:

``` json
{
  "status": "SUMMARIZING",
  "stage": "SUMMARIZING"
}
```

------------------------------------------------------------------------

## 2.4 IDs Are Opaque

The client must treat IDs as opaque values.

Do not encode business assumptions into identifiers.

Recommended representation:

``` text
UUID / UUID-compatible identifier
```

The exact database implementation may vary.

------------------------------------------------------------------------

## 2.5 Dates Use ISO 8601

All API timestamps should use ISO 8601 strings.

Example:

``` text
2026-08-23T10:30:00.000Z
```

------------------------------------------------------------------------

## 2.6 JSON Naming Convention

Public API JSON uses:

``` text
camelCase
```

Example:

``` json
{
  "documentId": "abc",
  "createdAt": "2026-08-23T10:30:00.000Z"
}
```

Database column naming may follow the ORM/database convention
independently.

------------------------------------------------------------------------

# 3. Core Domain Model

The initial system has three primary domain concepts:

``` text
Document
   |
   +--> Processing State
   |
   +--> Extracted Content
   |
   +--> Summary
```

A conceptual relationship:

``` text
Document
    |
    +---- 1 : 1 ---- Processing Information
    |
    +---- 1 : 0..N - Summary Results
```

The MVP may store processing information directly on the `Document`
record instead of creating a separate physical table.

The logical distinction must remain clear even if the database schema is
simplified.

------------------------------------------------------------------------

# 4. Document Entity

A `Document` represents an uploaded user file and its lifecycle.

## 4.1 Conceptual Fields

``` text
Document
├── id
├── originalFileName
├── fileType
├── mimeType
├── fileSizeBytes
├── storageKey
├── status
├── currentStage
├── extractionMethod
├── createdAt
├── updatedAt
├── completedAt?
└── failedAt?
```

## 4.2 Field Definitions

  -----------------------------------------------------------------------
  Field                   Type                    Description
  ----------------------- ----------------------- -----------------------
  id                      string                  Opaque document
                                                  identifier

  originalFileName        string                  Original uploaded
                                                  filename

  fileType                enum                    Logical supported type
                                                  such as PDF or IMAGE

  mimeType                string                  Validated MIME type

  fileSizeBytes           number                  File size in bytes

  storageKey              string                  Internal object-storage
                                                  reference

  status                  enum                    Overall lifecycle state

  currentStage            enum                    Current processing
                                                  stage

  extractionMethod        enum/null               Native extraction or
                                                  OCR when determined

  createdAt               datetime                Document creation
                                                  timestamp

  updatedAt               datetime                Last metadata update

  completedAt             datetime/null           Processing completion
                                                  time

  failedAt                datetime/null           Processing failure time
  -----------------------------------------------------------------------

The client must not receive internal storage credentials or private
storage URLs unless explicitly required.

------------------------------------------------------------------------

# 5. File Type Model

The API should distinguish the logical file category from the MIME type.

``` text
FileType
├── PDF
└── IMAGE
```

Supported image MIME types should be explicitly configured.

Example implementation set:

``` text
image/png
image/jpeg
image/webp
```

The exact supported list remains configurable.

The server must validate:

1.  Declared MIME type.
2.  File extension where useful.
3.  Actual file signature/content when the implementation supports
    reliable inspection.

Client-side validation is for UX only.

Server-side validation is authoritative.

------------------------------------------------------------------------

# 6. Processing Status Model

The system separates:

-   Overall status
-   Current processing stage

This avoids overloading one enum with both lifecycle and detailed
progress.

## 6.1 Overall Status

``` text
DocumentStatus

UPLOADED
PROCESSING
COMPLETED
FAILED
```

Optional future statuses:

``` text
DELETED
CANCELLED
```

Do not implement future states unless needed.

------------------------------------------------------------------------

## 6.2 Processing Stage

``` text
ProcessingStage

UPLOADING
UPLOADED
EXTRACTING
OCR_PROCESSING
NORMALIZING
SUMMARIZING
COMPLETED
FAILED
```

The physical implementation may omit transient stages that are never
persisted, but the API must expose a consistent stage model.

------------------------------------------------------------------------

# 7. Allowed State Transitions

The intended state machine is:

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
    |       |
    |       +--> NORMALIZING
    |
    +--> OCR_PROCESSING
            |
            v
       NORMALIZING
            |
            v
       SUMMARIZING
            |
            v
        COMPLETED
```

Failure is possible from processing stages:

``` text
UPLOADED
EXTRACTING
OCR_PROCESSING
NORMALIZING
SUMMARIZING
        |
        v
      FAILED
```

The implementation must not allow arbitrary backwards transitions unless
retry/reset logic explicitly performs them.

------------------------------------------------------------------------

# 8. Extraction Method

``` text
ExtractionMethod

NATIVE
OCR
```

This is determined by the processing system, not the client.

A future value such as `HYBRID` may be introduced if the system
processes native text and OCR-derived content together.

Do not add it before there is an implementation need.

------------------------------------------------------------------------

# 9. Summary Entity

A summary is a generated representation of a document for a specific
summary configuration.

## 9.1 Conceptual Fields

``` text
Summary
├── id
├── documentId
├── length
├── title
├── summary
├── keyPoints
├── mainIdeas
├── processingVersion
├── providerMetadata?
├── createdAt
└── updatedAt
```

## 9.2 Summary Length

``` text
SummaryLength

SHORT
MEDIUM
LONG
```

The length enum describes the requested level of detail, not an exact
guaranteed word count.

Exact output targets may be defined later in implementation
configuration.

------------------------------------------------------------------------

# 10. Structured Summary Result

The canonical application-level result shape is:

``` json
{
  "title": "string",
  "summary": "string",
  "keyPoints": [
    "string"
  ],
  "mainIdeas": [
    "string"
  ]
}
```

Validation requirements:

-   `title` must be a non-empty string after normalization.
-   `summary` must be a non-empty string after normalization.
-   `keyPoints` must be an array of strings.
-   `mainIdeas` must be an array of strings.
-   Empty or malformed provider output must not be silently persisted as
    a successful summary.

The exact minimum/maximum array sizes may be configured based on summary
length.

------------------------------------------------------------------------

# 11. Processing Metadata

The MVP should retain enough metadata to understand processing outcomes
without storing unnecessary sensitive content.

Conceptual fields:

``` text
ProcessingMetadata
├── extractionMethod
├── processingVersion
├── attemptCount
├── errorCode?
├── errorCategory?
├── startedAt?
├── completedAt?
└── durations?
```

Potential duration fields:

``` text
uploadDurationMs
extractionDurationMs
ocrDurationMs
summarizationDurationMs
totalProcessingDurationMs
```

The system should avoid exposing internal provider stack traces through
public APIs.

------------------------------------------------------------------------

# 12. Extracted Content Model

Extracted content is an internal processing artifact.

Conceptually:

``` text
ExtractedContent
├── documentId
├── normalizedText
├── pageCount?
├── characterCount
├── extractionMethod
├── processingVersion
└── createdAt
```

Whether full extracted text is persisted in PostgreSQL, another store,
or not retained after summarization is an implementation decision.

For the MVP:

> Do not expose full extracted content through the public API unless the
> product UI requires it.

------------------------------------------------------------------------

# 13. Error Model

All API errors should follow a predictable envelope.

Canonical shape:

``` json
{
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "This file type is not supported."
  }
}
```

Optional validation details:

``` json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": [
      {
        "field": "file",
        "message": "File exceeds the allowed size."
      }
    ]
  }
}
```

Internal diagnostic information must not be returned by default.

------------------------------------------------------------------------

# 14. Error Codes

Recommended initial error taxonomy:

## Validation

``` text
VALIDATION_ERROR
UNSUPPORTED_FILE_TYPE
FILE_TOO_LARGE
EMPTY_FILE
INVALID_FILE
```

## Document

``` text
DOCUMENT_NOT_FOUND
DOCUMENT_NOT_READY
DOCUMENT_PROCESSING_FAILED
```

## Processing

``` text
EXTRACTION_FAILED
OCR_FAILED
NO_EXTRACTABLE_CONTENT
SUMMARIZATION_FAILED
INVALID_SUMMARY_OUTPUT
```

## Infrastructure

``` text
STORAGE_ERROR
DATABASE_ERROR
PROCESSING_UNAVAILABLE
AI_PROVIDER_UNAVAILABLE
RATE_LIMITED
INTERNAL_ERROR
```

Do not expose raw vendor errors as public error codes.

------------------------------------------------------------------------

# 15. HTTP Status Mapping

Recommended mapping:

  -----------------------------------------------------------------------
  HTTP Status                         Usage
  ----------------------------------- -----------------------------------
  200                                 Successful retrieval/action

  201                                 Resource created

  202                                 Accepted for asynchronous
                                      processing

  400                                 Invalid request

  404                                 Resource not found

  409                                 Invalid state conflict/idempotency
                                      conflict when applicable

  413                                 File exceeds size limit

  422                                 Semantically valid request format
                                      but invalid processing input when
                                      applicable

  429                                 Rate limited

  500                                 Unexpected server failure

  502                                 Upstream provider failure when
                                      appropriate

  503                                 Temporary processing/provider
                                      unavailability
  -----------------------------------------------------------------------

The implementation should remain consistent rather than attempting to
use every status code.

------------------------------------------------------------------------

# 16. API Resource Model

The initial API surface is intentionally small.

Conceptual resources:

``` text
/documents
/documents/{documentId}
/documents/{documentId}/status
/documents/{documentId}/summaries
/documents/{documentId}/summaries/{summaryId}
```

The final route implementation may use `/api` prefixes according to the
Next.js application structure.

------------------------------------------------------------------------

# 17. Create Document Contract

## Endpoint

``` text
POST /documents
```

Purpose:

-   Validate an incoming document request or upload initiation.
-   Create a document record.
-   Return the document identifier and next action.

The exact implementation depends on the upload architecture.

------------------------------------------------------------------------

## 17.1 Server-Mediated Upload Variant

The request may use:

``` text
multipart/form-data
```

Conceptually:

``` text
file: binary
```

The server:

1.  Validates the file.
2.  Creates the document.
3.  Stores the file.
4.  Starts or schedules processing.

Recommended response:

``` json
{
  "document": {
    "id": "document-id",
    "status": "PROCESSING",
    "currentStage": "UPLOADED",
    "createdAt": "2026-08-23T10:30:00.000Z"
  }
}
```

A `201` or `202` status should be selected according to whether the
endpoint is considered resource creation only or processing acceptance.

------------------------------------------------------------------------

## 17.2 Direct-to-Storage Variant

Step 1:

``` text
POST /documents
```

Request:

``` json
{
  "fileName": "report.pdf",
  "mimeType": "application/pdf",
  "fileSizeBytes": 123456
}
```

Response:

``` json
{
  "document": {
    "id": "document-id",
    "status": "UPLOADING"
  },
  "upload": {
    "method": "PUT",
    "url": "signed-upload-url-or-equivalent",
    "expiresAt": "2026-08-23T10:35:00.000Z"
  }
}
```

Step 2:

``` text
PUT Object Storage URL
```

The browser uploads directly.

Step 3:

``` text
POST /documents/{documentId}/upload-complete
```

Response:

``` json
{
  "document": {
    "id": "document-id",
    "status": "UPLOADED",
    "currentStage": "UPLOADED"
  }
}
```

Processing can then begin.

The final implementation should choose **one primary upload flow** and
avoid supporting both without a requirement.

------------------------------------------------------------------------

# 18. Get Document Contract

## Endpoint

``` text
GET /documents/{documentId}
```

Response:

``` json
{
  "document": {
    "id": "document-id",
    "originalFileName": "report.pdf",
    "fileType": "PDF",
    "fileSizeBytes": 123456,
    "status": "COMPLETED",
    "currentStage": "COMPLETED",
    "extractionMethod": "NATIVE",
    "createdAt": "2026-08-23T10:30:00.000Z",
    "updatedAt": "2026-08-23T10:31:00.000Z",
    "completedAt": "2026-08-23T10:31:00.000Z"
  }
}
```

Do not include internal storage keys.

------------------------------------------------------------------------

# 19. Get Processing Status Contract

## Endpoint

``` text
GET /documents/{documentId}/status
```

Response:

``` json
{
  "documentId": "document-id",
  "status": "PROCESSING",
  "currentStage": "SUMMARIZING",
  "updatedAt": "2026-08-23T10:31:00.000Z"
}
```

Optional future field:

``` json
{
  "progress": {
    "completed": 2,
    "total": 5
  }
}
```

Do not expose percentage progress unless it is based on meaningful
measurable work.

Fake progress bars are discouraged.

------------------------------------------------------------------------

# 20. Request Summary Contract

There are two possible product behaviors.

## Model A --- Summary Requested During Upload

The user selects:

``` text
SHORT | MEDIUM | LONG
```

before processing.

The processing pipeline generates the selected summary.

## Model B --- Summary Requested After Extraction

The document is extracted once.

The user can request multiple summary lengths later.

For the MVP, either model is acceptable.

### Recommended Direction

Use:

> **One selected summary length per processing request, while designing
> the data model to support multiple summaries per document.**

This gives a clean user flow while preserving product evolution.

------------------------------------------------------------------------

## Endpoint

``` text
POST /documents/{documentId}/summaries
```

Request:

``` json
{
  "length": "MEDIUM"
}
```

Response when accepted:

``` json
{
  "summaryRequest": {
    "documentId": "document-id",
    "length": "MEDIUM",
    "status": "PROCESSING"
  }
}
```

Recommended HTTP status for asynchronous generation:

``` text
202 Accepted
```

If the implementation performs processing synchronously, the response
contract may return the completed summary directly, but asynchronous
acceptance is architecturally preferred for expensive work.

------------------------------------------------------------------------

# 21. Get Summary Contract

## Endpoint

``` text
GET /documents/{documentId}/summaries/{summaryId}
```

Response:

``` json
{
  "summary": {
    "id": "summary-id",
    "documentId": "document-id",
    "length": "MEDIUM",
    "title": "Document Overview",
    "summary": "The generated summary...",
    "keyPoints": [
      "Important point one",
      "Important point two"
    ],
    "mainIdeas": [
      "Main idea one",
      "Main idea two"
    ],
    "createdAt": "2026-08-23T10:31:00.000Z"
  }
}
```

A convenient implementation may also support:

``` text
GET /documents/{documentId}/summaries?length=MEDIUM
```

The implementation must avoid ambiguous duplicate results.

------------------------------------------------------------------------

# 22. Summary Availability Rules

A summary request is valid only when:

``` text
Document status == COMPLETED
```

or when the architecture explicitly supports requesting a summary as
part of the initial processing workflow.

If extracted content is not ready:

``` text
409 DOCUMENT_NOT_READY
```

Recommended response:

``` json
{
  "error": {
    "code": "DOCUMENT_NOT_READY",
    "message": "The document is still being processed."
  }
}
```

------------------------------------------------------------------------

# 23. Idempotency

Processing APIs should avoid unnecessary duplicate work.

Examples:

-   A client retries an upload completion request.
-   A browser sends the same summary request twice.
-   A network timeout occurs after the server accepted a request.

Recommended principles:

## Upload Completion

Repeated completion notifications should not create duplicate document
records.

## Summary Request

The system should determine whether an equivalent summary already exists
or is currently processing.

An equivalence model may include:

``` text
documentId
+
summaryLength
+
processingVersion
```

Possible behavior:

-   Existing completed equivalent summary -\> return/reuse it.
-   Equivalent summary already processing -\> return current processing
    reference.
-   No equivalent summary -\> create processing request.

The exact implementation may use database constraints or
application-level idempotency logic.

------------------------------------------------------------------------

# 24. Processing Version

A `processingVersion` concept is recommended.

Purpose:

``` text
Same document
+
Different extraction logic
+
Different summarization strategy
=
Potentially different result
```

This helps future evolution without overwriting historical assumptions.

Example:

``` text
v1
```

The MVP may use a single configured value.

Do not expose versioning complexity in the UI unless useful.

------------------------------------------------------------------------

# 25. Frontend Interaction Flow

## Upload

``` text
1. User selects file
2. Client performs preliminary validation
3. Upload request sent
4. Server validates
5. Document ID returned
6. UI transitions to processing view
```

## Processing

``` text
1. Frontend knows documentId
2. Poll GET /documents/{id}/status
3. Update stage when server state changes
4. Stop polling when:
      COMPLETED
      FAILED
```

Polling interval must be configurable.

Do not poll indefinitely after terminal state.

------------------------------------------------------------------------

## Summary Display

When completed:

``` text
GET Document
or
GET Summary
```

The UI displays:

``` text
Title
Summary
Key Points
Main Ideas
```

The frontend should not transform raw AI output into the canonical
summary shape.

The backend owns normalization and validation.

------------------------------------------------------------------------

# 26. Validation Contracts

Validation should exist at multiple layers.

## Client

For immediate UX:

-   File selected
-   File appears to be supported
-   File size appears acceptable

## API

Authoritative validation:

-   Required fields
-   Enum values
-   File type
-   File size
-   Document state

## Domain

Business rules:

-   Summary can only be requested at valid lifecycle points
-   Invalid state transitions are rejected
-   Duplicate processing is handled intentionally

## Provider Boundary

External output:

-   AI response structure
-   Extraction result validity

------------------------------------------------------------------------

# 27. Zod Contract Direction

Zod is the preferred runtime validation layer for TypeScript-facing
boundaries.

Recommended categories:

``` text
document.schema.ts
summary.schema.ts
api-error.schema.ts
```

A conceptual approach:

``` text
Request
   |
   v
Zod Validation
   |
   v
Domain Service
   |
   v
Provider
   |
   v
Zod Validation
   |
   v
Response
```

Schemas should be reusable where possible.

Do not duplicate request and response definitions unnecessarily.

------------------------------------------------------------------------

# 28. Data Ownership

  Data                 Owner
  -------------------- ------------------------------------------------
  Original file        Object storage
  Document metadata    PostgreSQL
  Processing state     PostgreSQL
  Extracted content    Processing layer / configured persistence
  Summary result       PostgreSQL
  AI API key           Server environment
  Upload credentials   Temporary/signed authorization when applicable

The frontend is a consumer of authoritative data, not the owner.

------------------------------------------------------------------------

# 29. Data Retention

The final retention policy is not yet locked.

The architecture must support eventual deletion of:

-   Original files
-   Extracted content
-   Generated summaries
-   Processing metadata where appropriate

For the MVP, define behavior explicitly before deployment.

At minimum, avoid promising permanent storage if retention is not
implemented.

------------------------------------------------------------------------

# 30. API Versioning

The MVP does not require `/v1` version prefixes unless the API is
intentionally exposed as a public product API.

However, the code should avoid breaking changes without considering
consumers.

Future options include:

``` text
/api/v1/documents
```

Do not introduce versioning infrastructure prematurely.

------------------------------------------------------------------------

# 31. Authentication Contract

Authentication is currently out of MVP scope unless explicitly required.

Therefore:

-   Do not design fake user ownership assumptions into every current
    API.
-   Do keep resource ownership concerns isolated so authentication can
    be added later.

A future document model may gain:

``` text
userId
workspaceId
```

These are intentionally absent from the current locked MVP contract.

------------------------------------------------------------------------

# 32. Rate Limiting

The MVP may not require a dedicated rate-limiting system.

If deployed publicly, especially with paid AI APIs, rate limiting should
be considered.

Potential future boundaries:

-   Upload rate
-   Summary generation rate
-   API request rate

Rate limiting must be implemented server-side.

------------------------------------------------------------------------

# 33. Contract Testing

Before declaring the project complete, verify:

## Upload

-   Valid PDF accepted
-   Valid image accepted
-   Unsupported type rejected
-   Oversized file rejected
-   Empty/corrupt input handled

## Status

-   Valid state returned
-   Terminal states stop polling
-   Failed processing is distinguishable

## Extraction

-   Native PDF does not unnecessarily trigger OCR
-   Scanned/image documents route to OCR
-   Empty extraction fails meaningfully

## Summary

-   Short request handled
-   Medium request handled
-   Long request handled
-   Structured result validates
-   Large document follows chunking strategy when required
-   Invalid provider output is not persisted as success

## Idempotency

-   Retried requests do not create uncontrolled duplicate work where
    equivalence can be determined

------------------------------------------------------------------------

# 34. Suggested Implementation Modules

A possible code organization:

``` text
src/
├── app/
│   └── api/
│       └── documents/
│
├── modules/
│   ├── documents/
│   │   ├── document.service.ts
│   │   ├── document.repository.ts
│   │   ├── document.schemas.ts
│   │   └── document.types.ts
│   │
│   ├── processing/
│   │   ├── processing.service.ts
│   │   ├── processing-state.ts
│   │   └── processing.types.ts
│   │
│   └── summaries/
│       ├── summary.service.ts
│       ├── summary.schemas.ts
│       └── summary.types.ts
│
├── providers/
│   ├── storage/
│   ├── extraction/
│   ├── ocr/
│   └── ai/
│
├── lib/
│   ├── db.ts
│   └── validation.ts
│
└── prisma/
    └── schema.prisma
```

This is a suggested structure, not a locked folder contract.

Agents must adapt to the actual repository structure once implementation
begins.

------------------------------------------------------------------------

# 35. Example End-to-End API Sequence

``` text
CLIENT
  |
  | POST /documents
  v
DOCUMENT CREATED
  |
  v
FILE STORED
  |
  v
PROCESSING STARTED
  |
  +--> EXTRACTING
  |
  +--> OCR if required
  |
  +--> NORMALIZING
  |
  +--> SUMMARIZING
  |
  v
DOCUMENT COMPLETED
  |
  v
CLIENT GET /documents/{id}/status
  |
  v
CLIENT GET /documents/{id}/summaries/{summaryId}
```

If summary generation is requested separately:

``` text
CLIENT
  |
  | POST /documents/{id}/summaries
  v
202 Accepted
  |
  v
PROCESSING
  |
  v
CLIENT POLLS STATUS
  |
  v
SUMMARY AVAILABLE
```

------------------------------------------------------------------------

# 36. Non-Negotiable API and Data Guardrails

1.  The server is the source of truth.
2.  Processing state must be explicit and durable.
3.  IDs are opaque.
4.  Public JSON uses consistent naming.
5.  Timestamps use ISO 8601.
6.  Errors use a predictable envelope.
7.  AI output must be validated before success persistence.
8.  The client must not own AI normalization.
9.  Internal storage/provider details must not leak into public
    responses.
10. Duplicate processing must be considered intentionally.
11. Invalid lifecycle transitions must be rejected.
12. Public contracts should not be tightly coupled to provider-specific
    implementations.

------------------------------------------------------------------------

# 37. Open Decisions Before Implementation

The following must be finalized during implementation planning:

-   Exact file size limit
-   Exact supported image MIME types
-   Primary upload flow
-   Exact endpoint naming
-   Whether summaries are generated during initial processing or
    requested after extraction
-   Whether extracted content is persisted
-   Exact processing metadata schema
-   Exact polling interval
-   Exact idempotency implementation
-   Exact processing-version representation
-   Exact database schema and indexes

Once decided, these must be reflected consistently in:

-   `PROJECT_CONTEXT.md`
-   `ARCHITECTURE.md` where architecture changes are involved
-   Implementation code
-   README where relevant

------------------------------------------------------------------------

# Final Contract Position

The system exposes a deliberately small but durable contract surface:

``` text
Document
    |
    +--> Upload / Registration
    |
    +--> Processing Status
    |
    +--> Extraction Result (internal)
    |
    +--> One or more Summary Results
```

The core contract philosophy is:

> **The client interacts with stable document and summary resources. The
> backend owns processing orchestration, lifecycle transitions,
> extraction routing, AI provider interaction, validation, and
> persistence.**

This keeps the MVP straightforward while ensuring that implementation
details such as OCR engines, AI providers, storage systems, queues, and
processing workers can evolve without forcing a redesign of the product
contract.

**End of API & Data Contracts**
