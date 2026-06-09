export interface AviaPageImage {
  label: string;
  mimeType: string;
  buffer: Buffer;
}

function streamBounds(pdfText: string, pdfBuffer: Buffer, imagePosition: number) {
  const streamMarker = pdfText.indexOf('stream', imagePosition);
  const endMarker = pdfText.indexOf('endstream', streamMarker);
  if (streamMarker === -1 || endMarker === -1) return null;

  let start = streamMarker + 'stream'.length;
  if (pdfBuffer[start] === 0x0d && pdfBuffer[start + 1] === 0x0a) start += 2;
  else if (pdfBuffer[start] === 0x0a || pdfBuffer[start] === 0x0d) start += 1;

  let end = endMarker;
  while (
    end > start &&
    (pdfBuffer[end - 1] === 0x0a || pdfBuffer[end - 1] === 0x0d || pdfBuffer[end - 1] === 0x20)
  ) {
    end -= 1;
  }

  return { start, end };
}

function buildSampleIndexes(total: number, maxItems: number) {
  if (total <= maxItems) return Array.from({ length: total }, (_, index) => index);

  const preferred = [0, 1, 2, 3, total - 1, total - 2, total - 3];
  const selected = new Set(preferred.filter((index) => index >= 0 && index < total));
  const remaining = Math.max(0, maxItems - selected.size);

  for (let i = 0; i < remaining; i += 1) {
    const index = Math.round((i + 1) * (total - 1) / (remaining + 1));
    selected.add(index);
  }

  return Array.from(selected).sort((a, b) => a - b).slice(0, maxItems);
}

export function extractPdfPageImages(pdfBuffer: Buffer, maxPages = 0): AviaPageImage[] {
  const pdfText = pdfBuffer.toString('latin1');
  const positions: number[] = [];
  let index = 0;

  while ((index = pdfText.indexOf('/Subtype /Image', index)) !== -1) {
    positions.push(index);
    index += '/Subtype /Image'.length;
  }

  const images: AviaPageImage[] = [];
  const imageIndexes = maxPages > 0
    ? buildSampleIndexes(positions.length, maxPages)
    : Array.from({ length: positions.length }, (_, pageIndex) => pageIndex);
  for (const imageIndex of imageIndexes) {
    const bounds = streamBounds(pdfText, pdfBuffer, positions[imageIndex]);
    if (!bounds) continue;

    const chunk = pdfBuffer.subarray(bounds.start, bounds.end);
    const isJpeg = chunk[0] === 0xff && chunk[1] === 0xd8;
    const isPng = chunk[0] === 0x89 && chunk[1] === 0x50 && chunk[2] === 0x4e && chunk[3] === 0x47;
    if (!isJpeg && !isPng) continue;

    images.push({
      label: `PDF第${imageIndex + 1}页`,
      mimeType: isJpeg ? 'image/jpeg' : 'image/png',
      buffer: Buffer.from(chunk),
    });
  }

  return images;
}
