/**
 * Splits document text into chunks prioritizing:
 * 1. Sections (\n# )
 * 2. Paragraphs (\n\n)
 * 3. Sentences (. , ! , ? )
 * 4. Hard character limit slices
 * 
 * Ensures no text is lost, chunks preserve their order, and each chunk is <= maxChunkSize.
 */
export function chunkText(text: string, maxChunkSize: number = 8000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  function splitBlock(block: string, delimiters: string[]): string[] {
    if (block.length <= maxChunkSize || delimiters.length === 0) {
      if (block.length <= maxChunkSize) {
        return [block];
      }
      
      // Fallback: Hard slice
      const chunks: string[] = [];
      let remaining = block;
      while (remaining.length > 0) {
        chunks.push(remaining.substring(0, maxChunkSize));
        remaining = remaining.substring(maxChunkSize);
      }
      return chunks;
    }

    const currentDelimiter = delimiters[0];
    const remainingDelimiters = delimiters.slice(1);

    const parts = splitWithDelimiter(block, currentDelimiter);
    const resultChunks: string[] = [];
    let tempChunk = '';

    for (const part of parts) {
      if (part.length > maxChunkSize) {
        if (tempChunk) {
          resultChunks.push(tempChunk);
          tempChunk = '';
        }
        resultChunks.push(...splitBlock(part, remainingDelimiters));
      } else {
        if (tempChunk.length + part.length <= maxChunkSize) {
          tempChunk += part;
        } else {
          if (tempChunk) {
            resultChunks.push(tempChunk);
          }
          tempChunk = part;
        }
      }
    }

    if (tempChunk) {
      resultChunks.push(tempChunk);
    }

    return resultChunks;
  }

  return splitBlock(text, ['\n# ', '\n\n', '. ', '! ', '? ']);
}

function splitWithDelimiter(text: string, delimiter: string): string[] {
  if (!text.includes(delimiter)) {
    return [text];
  }

  const parts = text.split(delimiter);
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0) {
      if (part) result.push(part);
    } else {
      result.push(delimiter + part);
    }
  }

  return result;
}
