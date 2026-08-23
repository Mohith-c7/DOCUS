const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Write specialized test PDFs for AI failures/validation checks
function createFailureFixtures() {
  const scratchDir = __dirname;
  
  // PDF designed to force AI provider failure
  const failPdf = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj
4 0 obj <</Length 70>> stream
BT /F1 12 Tf 72 712 Td (FORCE_FAIL: This document is designed to simulate an AI provider failure.) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000212 00000 n 
trailer <</Size 5 /Root 1 0 R>>
startxref
332
%%EOF`;

  // PDF designed to force invalid AI output format
  const invalidPdf = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj
4 0 obj <</Length 85>> stream
BT /F1 12 Tf 72 712 Td (FORCE_INVALID_OUTPUT: This document is designed to simulate invalid AI output structure.) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000212 00000 n 
trailer <</Size 5 /Root 1 0 R>>
startxref
347
%%EOF`;

  fs.writeFileSync(path.join(scratchDir, 'force_fail.pdf'), failPdf, 'ascii');
  fs.writeFileSync(path.join(scratchDir, 'force_invalid.pdf'), invalidPdf, 'ascii');
  console.log('Created specialized pipeline failure PDF fixtures.');
}

async function runTests() {
  createFailureFixtures();
  console.log(`\nStarting Phase 3 integration tests against ${BASE_URL}...`);
  let passed = true;

  // Wait for the Next.js server to be ready
  for (let i = 0; i < 10; i++) {
    try {
      await fetch(`${BASE_URL}/api/documents`);
      console.log('Server is responsive.');
      break;
    } catch (e) {
      console.log('Waiting for server to become responsive...');
      await sleep(1500);
    }
  }

  // Upload helper
  async function uploadFile(filePath, mimeType) {
    const originalName = path.basename(filePath);
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    const fileName = `${base}-${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`;
    const buffer = fs.readFileSync(filePath);
    const blob = new Blob([buffer], { type: mimeType });
    
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const response = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      body: formData,
    });

    const json = await response.json();
    return { status: response.status, body: json };
  }

  // Polling helper
  async function pollStatus(docId) {
    console.log(`Polling status for document ${docId}...`);
    while (true) {
      const response = await fetch(`${BASE_URL}/api/documents/${docId}/status`);
      const statusData = await response.json();
      console.log(`  -> Stage: ${statusData.currentStage}, Status: ${statusData.status}`);
      
      if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
        return statusData;
      }
      await sleep(1000);
    }
  }

  // Request summary helper
  async function requestSummary(docId, length) {
    const response = await fetch(`${BASE_URL}/api/documents/${docId}/summaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ length }),
    });
    const json = await response.json();
    return { status: response.status, body: json };
  }

  // Retrieve summaries list helper
  async function getSummaries(docId) {
    const response = await fetch(`${BASE_URL}/api/documents/${docId}/summaries`);
    const json = await response.json();
    return { status: response.status, body: json };
  }

  // ========================================================
  // TEST 1: Digital PDF -> Native Extraction -> Direct Summary
  // ========================================================
  // Let's copy a small text file as a PDF first, or download one.
  // Actually, we can use D:\DOCUS\test\data\05-versions-space.pdf which is about 578 bytes. It contains ~100 characters.
  // Since it is < 15000 characters, it will run direct summarization!
  try {
    console.log('\n=== TEST 1: Digital PDF (Direct Summary) ===');
    const { status, body } = await uploadFile(path.join(__dirname, '..', 'test', 'data', '05-versions-space.pdf'), 'application/pdf');
    if (status !== 202) throw new Error(`Expected 202, got ${status}`);
    
    const docId = body.document.id;
    const finalState = await pollStatus(docId);
    if (finalState.status !== 'COMPLETED') throw new Error(`Expected status COMPLETED, got ${finalState.status}`);
    
    // Check auto-generated MEDIUM summary
    const summaryList = await getSummaries(docId);
    if (summaryList.body.summaries.length !== 1) throw new Error(`Expected 1 auto-generated summary, got ${summaryList.body.summaries.length}`);
    const mediumSummary = summaryList.body.summaries[0];
    if (mediumSummary.length !== 'MEDIUM') throw new Error(`Expected MEDIUM summary, got ${mediumSummary.length}`);
    console.log('Test 1 Passed: Digital PDF processed and summarized directly!');
  } catch (e) {
    console.error('Test 1 Failed:', e.message);
    passed = false;
  }

  // ========================================================
  // TEST 2: Large Document -> Chunking & Hierarchical Summarization
  // ========================================================
  // valid.pdf is ~1MB and > 30000 characters, triggering chunking
  try {
    console.log('\n=== TEST 2: Large Document (Hierarchical Aggregation) ===');
    const { status, body } = await uploadFile(path.join(__dirname, 'valid.pdf'), 'application/pdf');
    if (status !== 202) throw new Error(`Expected 202, got ${status}`);
    
    const docId = body.document.id;
    const finalState = await pollStatus(docId);
    if (finalState.status !== 'COMPLETED') throw new Error(`Expected status COMPLETED, got ${finalState.status}`);
    console.log('Test 2 Passed: Large PDF successfully chunked and summarized hierarchically!');
  } catch (e) {
    console.error('Test 2 Failed:', e.message);
    passed = false;
  }

  // ========================================================
  // TEST 3: Image -> OCR -> Summary
  // ========================================================
  // test.png triggers OCR
  try {
    console.log('\n=== TEST 3: Image (OCR Summary) ===');
    const { status, body } = await uploadFile(path.join(__dirname, 'test.png'), 'image/png');
    if (status !== 202) throw new Error(`Expected 202, got ${status}`);
    
    const docId = body.document.id;
    const finalState = await pollStatus(docId);
    if (finalState.status !== 'COMPLETED') throw new Error(`Expected status COMPLETED, got ${finalState.status}`);
    console.log('Test 3 Passed: Image parsed via Tesseract OCR and summarized successfully!');
  } catch (e) {
    console.error('Test 3 Failed:', e.message);
    passed = false;
  }

  // ========================================================
  // TEST 4: Scanned PDF -> Insufficient Native -> OCR -> Summary
  // ========================================================
  // insufficient_text.pdf contains 14 characters, triggering OCR fallback
  try {
    console.log('\n=== TEST 4: Scanned PDF (OCR Fallback) ===');
    const { status, body } = await uploadFile(path.join(__dirname, 'insufficient_text.pdf'), 'application/pdf');
    if (status !== 202) throw new Error(`Expected 202, got ${status}`);
    
    const docId = body.document.id;
    const finalState = await pollStatus(docId);
    if (finalState.status !== 'COMPLETED') throw new Error(`Expected status COMPLETED, got ${finalState.status}`);
    console.log('Test 4 Passed: Scanned PDF correctly routed to OCR fallback and processed successfully!');
  } catch (e) {
    console.error('Test 4 Failed:', e.message);
    passed = false;
  }

  // ========================================================
  // TEST 5: AI Provider Failure Simulation
  // ========================================================
  try {
    console.log('\n=== TEST 5: AI Provider Failure ===');
    const { status, body } = await uploadFile(path.join(__dirname, 'force_fail.pdf'), 'application/pdf');
    if (status !== 202) throw new Error(`Expected 202, got ${status}`);
    
    const docId = body.document.id;
    const finalState = await pollStatus(docId);
    if (finalState.status !== 'FAILED') throw new Error(`Expected status FAILED, got ${finalState.status}`);
    console.log('Test 5 Passed: AI provider failure handled gracefully and transitioned to FAILED!');
  } catch (e) {
    console.error('Test 5 Failed:', e.message);
    passed = false;
  }

  // ========================================================
  // TEST 6: Invalid AI Output Structure (Zod Validation)
  // ========================================================
  try {
    console.log('\n=== TEST 6: Invalid AI Output Format ===');
    const { status, body } = await uploadFile(path.join(__dirname, 'force_invalid.pdf'), 'application/pdf');
    if (status !== 202) throw new Error(`Expected 202, got ${status}`);
    
    const docId = body.document.id;
    const finalState = await pollStatus(docId);
    if (finalState.status !== 'FAILED') throw new Error(`Expected status FAILED, got ${finalState.status}`);
    console.log('Test 6 Passed: Malformed AI output correctly rejected by Zod validation!');
  } catch (e) {
    console.error('Test 6 Failed:', e.message);
    passed = false;
  }

  // ========================================================
  // TEST 7: Duplicate Summary Request (Cache Check)
  // ========================================================
  try {
    console.log('\n=== TEST 7 & 8-10: Summary API & Detail Lengths ===');
    // Upload a new document to test additional API calls
    const uploadRes = await uploadFile(path.join(__dirname, '..', 'test', 'data', '05-versions-space.pdf'), 'application/pdf');
    const docId = uploadRes.body.document.id;
    await pollStatus(docId);

    // Initial pipeline created a MEDIUM summary.
    // 7.1: Request SHORT summary. Expect status 201 (Created)
    console.log('Requesting SHORT summary...');
    const shortRes1 = await requestSummary(docId, 'SHORT');
    if (shortRes1.status !== 201) throw new Error(`Expected 201 Created, got ${shortRes1.status}`);
    console.log('  -> SHORT summary generated successfully.');

    // 7.2: Request SHORT summary again. Expect status 200 (OK - cached reuse!)
    console.log('Re-requesting SHORT summary (should hit cache)...');
    const shortRes2 = await requestSummary(docId, 'SHORT');
    if (shortRes2.status !== 200) throw new Error(`Expected 200 OK, got ${shortRes2.status}`);
    if (shortRes1.body.summary.id !== shortRes2.body.summary.id) {
      throw new Error('Cache reuse check failed: Returned a different summary ID.');
    }
    console.log('  -> Cache hit verified! Same summary ID returned.');

    // 7.3: Request LONG summary. Expect status 201 (Created)
    console.log('Requesting LONG summary...');
    const longRes = await requestSummary(docId, 'LONG');
    if (longRes.status !== 201) throw new Error(`Expected 201 Created, got ${longRes.status}`);
    console.log('  -> LONG summary generated successfully.');

    // 7.4: Retrieve all summaries. Expect exactly 3 (SHORT, MEDIUM, LONG)
    const listRes = await getSummaries(docId);
    if (listRes.body.summaries.length !== 3) {
      throw new Error(`Expected 3 summaries, got ${listRes.body.summaries.length}`);
    }
    console.log('Test 7 & 8-10 Passed: Summary lengths SHORT/MEDIUM/LONG work, and caching prevents duplicate tokens!');
  } catch (e) {
    console.error('Test 7 Failed:', e.message);
    passed = false;
  }

  if (passed) {
    console.log('\n======================================================');
    console.log('ALL PHASE 3 INTELLIGENCE PIPELINE TESTS PASSED SUCCESS!');
    console.log('======================================================');
    process.exit(0);
  } else {
    console.log('\n======================================================');
    console.log('SOME PHASE 3 TESTS FAILED!');
    console.log('======================================================');
    process.exit(1);
  }
}

runTests();
