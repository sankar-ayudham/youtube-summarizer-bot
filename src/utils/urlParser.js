const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function isYouTubeUrl(text) {
  if (!text) return false;
  return YOUTUBE_REGEX.test(text);
}

export function extractVideoId(text) {
  if (!text) return null;
  const match = text.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}
