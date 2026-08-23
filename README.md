# Document Summary Assistant (DocuSum)

An engineering-hardened, production-ready document ingestion, text extraction, and structured AI summarization pipeline built with Next.js, PostgreSQL (Prisma), Local Storage, Tesseract OCR, and the Google Gemini API.

---

## 1. Project Overview & Problem Solved
Managing large stacks of mixed format files (digital PDFs, scanned PDFs, images) is challenging. Standard tools often struggle to:
- Dynamically distinguish between structured digital texts and flat scan images.
- Provide clean formatted text output without whitespace noise.
- Summarize extremely long files (exceeding context limits or producing generic summaries).
- Ensure strict structured output constraints (JSON schema formatting) from LLMs.

**DocuSum** addresses these problems by implementing a robust multi-stage backend pipeline coupled with an intuitive, polling-driven web UI.

---

## 2. Key Features
- **Smart Routing Ingestion**: Accepts PDFs and Images, running client-side Zod and server-side checks.
- **Auto-OCR Fallback**: Inspects extracted text density and character counts. If insufficient, it routes to `Tesseract.recognize` OCR dynamically.
- **Whitespace Normalization**: Removes duplicate breaks, spaces, and line noise while preserving paragraph structures.
- **Adaptive Summarization Strategy**:
  - **Direct**: Summarizes directly if the text is small (`<= 15000` characters).
  - **Hierarchical**: Chunk-splits large documents (`> 15000` characters), runs concurrent chunk summarizations, and aggregates them into a final summary.
- **Structured LLM Schema Enforcement**: Leverages OpenAPI JSON schemas directly inside the Gemini API `response_schema` generation configuration.
- **Token Cache Reuse (Idempotency)**: Prevents redundant expensive AI requests by caching uploaded file metadata and requested summary detail levels.
- **Persistent State Resiliency**: Synchronizes document IDs with URL query params (`?docId=...`), sustaining refresh states.

---

## 3. Technology Stack
- **Framework**: Next.js 16.3 (App Router with Turbopack)
- **Database**: PostgreSQL with Prisma ORM
- **Object Storage**: Local File Storage with directory traversal protection
- **PDF Extraction**: `pdf-parse` (v1.1.1, worker-free Legacy CommonJS build)
- **OCR Engine**: `tesseract.js` (marked as external package for Next.js server compatibility)
- **AI Model**: Gemini `gemini-1.5-flash` model via direct HTTP `fetch` integrations
- **Styling**: Tailwind CSS (Tailwind v4 `@import` syntax)

---

## 4. Architecture Overview

### Data Flow Layout:
```
User Ingest (PDF / Image) 
    ↳ POST /api/documents (Size & MIME validation)
        ↳ Local Object Storage upload (storage/uploads/)
        ↳ Database Record Initialization (UPLOADED)
            ↳ Background Pipeline Trigger (processDocument)
                ↳ Native Text Extract? 
                    ├── YES (>50 chars usable) ➔ Normalize Text
                    └── NO (Scanned/Empty)     ➔ Run Tesseract OCR ➔ Normalize
                        ↳ Selection: Size > 15000 chars?
                            ├── YES ➔ Split Chunks ➔ Map concurrent summaries ➔ Aggregate final
                            └── NO  ➔ Direct Summarize
                                ↳ Zod Schema Verification
                                ↳ Database Summary Write
                                ↳ Ingestion COMPLETE
```

---

## 5. Local Setup Instructions

### Prerequisites
- Node.js (v18.x or newer recommended)
- Docker Desktop (for running PostgreSQL)

### 1. Database Setup
Start the local PostgreSQL instance using the provided docker-compose configuration:
```bash
docker compose up -d
```

Apply Prisma database schema migrations:
```bash
npx prisma db push
```

### 2. Environment Configuration
Create a `.env` file in the root directory (based on `.env.example`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docus?schema=public"
GEMINI_API_KEY="your-gemini-api-key"
PORT=3001
```
*Note: If you do not have a Gemini API Key, use `mock-gemini-api-key-for-foundation` to enable full mock testing capabilities.*

### 3. Install Dependencies
```bash
npm install
```

### 4. Running the Development Server
```bash
npm run dev
# Server will start on http://localhost:3001
```

### 5. Running the Production Build
```bash
npm run build
npm run start
```

---

## 6. How the Pipeline Works

### 1. OCR Strategy
PDF native extracts are run through a density validator check. If a file returns fewer than `50` characters or has a non-whitespace ratio below `10%`, it is routed to `Tesseract.recognize`. The Next.js config includes `serverExternalPackages: ['tesseract.js']` to compile worker threads safely inside compiled server chunks.

### 2. Large-Document Chunking & Aggregation
When document character counts exceed `15000`, the orchestrator splits the text into chunks up to `8000` characters, prioritizing splitting on headings (`\n# `), paragraph breaks (`\n\n`), and sentences (`. `). 

Chunk summaries are generated in parallel (bounded concurrency capped at `3`), formatted into a consolidated context block, and processed through a final aggregation call to compile the Zod-verified output.

---

## 7. Known Limitations
- **Scanned PDF Page Extraction**: Tesseract OCR natively processes raster image files. Multi-page scanned PDFs are routed to a simulated OCR extractor locally to avoid compiling heavy canvas rendering dependencies in Windows CLI environments.

---

## 8. Scalability Direction
- **Redis Queueing**: Transition the background `processDocument` promise calls into a persistent Redis queue (such as BullMQ) to ensure queue execution survival when the server restarts.
- **Dedicated OCR Services**: Offload Tesseract compute loads from the main Next.js API processes to standalone serverless functions or containerized microservices (e.g. OCRmyPDF cluster).
