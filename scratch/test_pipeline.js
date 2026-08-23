const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log(`Starting integration tests against ${BASE_URL}...`);
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

  // Helper to construct FormData and upload a file
  async function uploadFile(filePath, mimeType) {
    const fileName = path.basename(filePath);
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

  // Helper to poll status
  async function pollStatus(docId) {
    console.log(`Polling status for document ${docId}...`);
    while (true) {
      const response = await fetch(`${BASE_URL}/api/documents/${docId}/status`);
      const statusData = await response.json();
      console.log(`  -> Current Stage: ${statusData.currentStage}, Status: ${statusData.status}`);
      
      if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED' || statusData.currentStage === 'SUMMARIZING') {
        return statusData;
      }
      await sleep(1000);
    }
  }

  // TEST 1: Valid PDF Ingestion & Extraction Pipeline
  try {
    console.log('\n--- TEST 1: Valid PDF Ingestion ---');
    const { status, body } = await uploadFile(path.join(__dirname, 'valid.pdf'), 'application/pdf');
    
    if (status !== 202) {
      throw new Error(`Expected 202 Accepted, got ${status}. Body: ${JSON.stringify(body)}`);
    }
    
    const docId = body.document.id;
    console.log(`Upload successful. Document ID: ${docId}`);
    
    const finalState = await pollStatus(docId);
    if (finalState.currentStage !== 'SUMMARIZING') {
      throw new Error(`Expected stage to reach SUMMARIZING, got ${finalState.currentStage}`);
    }
    console.log('Test 1 Passed: Valid PDF reached SUMMARIZING stage successfully!');

    // Check if the normalized file was saved in storage
    const storagePath = path.resolve(__dirname, '..', 'storage', 'extracted', `${docId}.txt`);
    if (fs.existsSync(storagePath)) {
      const text = fs.readFileSync(storagePath, 'utf8');
      console.log(`  -> Extracted text preview: "${text.substring(0, 60)}..."`);
      console.log('Confirmed processed file exists in storage.');
    } else {
      throw new Error('Normalized file not found in storage directory.');
    }
  } catch (error) {
    console.error('Test 1 Failed:', error.message);
    passed = false;
  }

  // TEST 2: Insufficient Text PDF (Usability validation fails)
  try {
    console.log('\n--- TEST 2: Insufficient Text PDF ---');
    const { status, body } = await uploadFile(path.join(__dirname, 'insufficient_text.pdf'), 'application/pdf');
    
    if (status !== 202) {
      throw new Error(`Expected 202 Accepted, got ${status}`);
    }
    
    const docId = body.document.id;
    console.log(`Upload successful. Document ID: ${docId}`);
    
    const finalState = await pollStatus(docId);
    if (finalState.status !== 'FAILED') {
      throw new Error(`Expected status to be FAILED, got ${finalState.status}`);
    }
    console.log('Test 2 Passed: PDF with insufficient text correctly transitioned to FAILED status!');
  } catch (error) {
    console.error('Test 2 Failed:', error.message);
    passed = false;
  }

  // TEST 3: Empty File Upload Rejection
  try {
    console.log('\n--- TEST 3: Empty File Rejection ---');
    const { status, body } = await uploadFile(path.join(__dirname, 'empty.pdf'), 'application/pdf');
    
    if (status !== 400) {
      throw new Error(`Expected 400 Bad Request, got ${status}. Body: ${JSON.stringify(body)}`);
    }
    
    if (body.error.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected error code VALIDATION_ERROR, got ${body.error.code}`);
    }
    console.log('Test 3 Passed: Empty file rejected with VALIDATION_ERROR!');
  } catch (error) {
    console.error('Test 3 Failed:', error.message);
    passed = false;
  }

  // TEST 4: Image Upload (OCR Deferred path)
  try {
    console.log('\n--- TEST 4: Image Upload (OCR Fail) ---');
    const { status, body } = await uploadFile(path.join(__dirname, 'test.png'), 'image/png');
    
    if (status !== 202) {
      throw new Error(`Expected 202 Accepted, got ${status}`);
    }
    
    const docId = body.document.id;
    console.log(`Upload successful. Document ID: ${docId}`);
    
    const finalState = await pollStatus(docId);
    if (finalState.status !== 'FAILED') {
      throw new Error(`Expected status to be FAILED, got ${finalState.status}`);
    }
    console.log('Test 4 Passed: Image correctly transitioned to OCR_PROCESSING -> FAILED stage!');
  } catch (error) {
    console.error('Test 4 Failed:', error.message);
    passed = false;
  }

  // TEST 5: Unsupported File Type Rejection
  try {
    console.log('\n--- TEST 5: Unsupported File Type ---');
    const { status, body } = await uploadFile(path.join(__dirname, 'unsupported.zip'), 'application/zip');
    
    if (status !== 400) {
      throw new Error(`Expected 400 Bad Request, got ${status}. Body: ${JSON.stringify(body)}`);
    }
    
    if (body.error.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected error code VALIDATION_ERROR, got ${body.error.code}`);
    }
    console.log('Test 5 Passed: Unsupported file type rejected successfully!');
  } catch (error) {
    console.error('Test 5 Failed:', error.message);
    passed = false;
  }

  if (passed) {
    console.log('\n=====================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY!');
    console.log('=====================================');
    process.exit(0);
  } else {
    console.log('\n=====================================');
    console.log('SOME TESTS FAILED!');
    console.log('=====================================');
    process.exit(1);
  }
}

runTests();
