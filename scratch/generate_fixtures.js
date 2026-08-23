const fs = require('fs');
const path = require('path');

const SCRATCH_DIR = path.resolve(__dirname);
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

// 1. Generate a valid, text-based PDF containing > 50 characters
const validPdfContent = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj
4 0 obj <</Length 86>> stream
BT /F1 12 Tf 72 712 Td (Hello World! This is a valid native text PDF document built for testing. It has enough characters to pass the usability check.) Tj ET
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
348
%%EOF
`;

fs.writeFileSync(path.join(SCRATCH_DIR, 'valid.pdf'), validPdfContent, 'ascii');
console.log('Created scratch/valid.pdf');

// 2. Generate a PDF with insufficient text (< 50 characters)
const tinyPdfContent = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj
4 0 obj <</Length 20>> stream
BT /F1 12 Tf 72 712 Td (Too short) Tj ET
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
282
%%EOF
`;

fs.writeFileSync(path.join(SCRATCH_DIR, 'insufficient_text.pdf'), tinyPdfContent, 'ascii');
console.log('Created scratch/insufficient_text.pdf');

// 3. Generate empty file (0 bytes)
fs.writeFileSync(path.join(SCRATCH_DIR, 'empty.pdf'), Buffer.alloc(0));
console.log('Created scratch/empty.pdf');

// 4. Generate a dummy image file (10 bytes PNG header)
const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
fs.writeFileSync(path.join(SCRATCH_DIR, 'test.png'), pngHeader);
console.log('Created scratch/test.png');

// 5. Generate unsupported file type
fs.writeFileSync(path.join(SCRATCH_DIR, 'unsupported.zip'), 'dummy zip content');
console.log('Created scratch/unsupported.zip');
