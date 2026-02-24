export function chunkTranscript(transcript, maxChars = 8000) {
  if (transcript.length <= maxChars) return [transcript];

  const lines = transcript.split("\n");
  const chunks = [];
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}
