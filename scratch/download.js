const fs = require('fs');
const path = require('path');

async function download(url, dest) {
  console.log(`Downloading ${url}...`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(arrayBuffer));
  console.log(`Saved to ${dest}`);
}

async function main() {
  try {
    await download('https://raw.githubusercontent.com/ocrmypdf/OCRmyPDF/main/tests/resources/c02-ocr.pdf', path.resolve(__dirname, 'scanned.pdf'));
    process.exit(0);
  } catch (error) {
    console.error('Download failed:', error.message);
    process.exit(1);
  }
}

main();
