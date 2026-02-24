import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

export class TranscriptService {
  async fetchTranscript(videoId) {
    logger.info(`Fetching transcript for: ${videoId}`);
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      // Get video JSON info from yt-dlp
      const { stdout } = await execAsync(
        `yt-dlp --write-auto-sub --sub-lang en --skip-download --print-json "${url}"`,
        { timeout: 60000, maxBuffer: 50 * 1024 * 1024 },
      );

      // Parse first line of output (the JSON)
      const info = JSON.parse(stdout.trim().split("\n")[0]);
      const videoTitle = info.fulltitle || info.title || "YouTube Video";

      // Find English subtitle URL from requested_subtitles or automatic_captions
      let subtitleUrl = null;

      // Try requested_subtitles first (English)
      if (info.requested_subtitles?.en?.url) {
        subtitleUrl = info.requested_subtitles.en.url;
        logger.info("Found English subtitle URL");
      }

      // Try automatic_captions
      if (!subtitleUrl && info.automatic_captions) {
        const langs = Object.keys(info.automatic_captions);
        const enLang = langs.find((l) => l.startsWith("en")) || langs[0];
        if (enLang) {
          const formats = info.automatic_captions[enLang];
          // Prefer vtt format
          const vtt = formats.find((f) => f.ext === "vtt") || formats[0];
          if (vtt?.url) {
            subtitleUrl = vtt.url;
            logger.info(`Found auto-caption URL for lang: ${enLang}`);
          }
        }
      }

      if (!subtitleUrl) {
        throw new Error("No subtitle URL found in video info");
      }

      // Fetch the VTT/subtitle content
      const res = await fetch(subtitleUrl);
      if (!res.ok) throw new Error(`Failed to fetch subtitles: ${res.status}`);

      const content = await res.text();
      logger.info(`Subtitle content fetched: ${content.length} chars`);

      // Parse VTT format
      const transcript = this._parseVTT(content);

      if (!transcript || transcript.length < 50) {
        throw new Error("Parsed transcript is too short or empty");
      }

      logger.info(`Transcript ready: ${transcript.length} chars`);
      return { transcript, videoTitle };
    } catch (err) {
      logger.error("Transcript fetch failed:", err.message);
      throw new Error(
        `Could not get transcript: ${err.message}\n\nMake sure the video has CC/subtitles.`,
      );
    }
  }

  _parseVTT(content) {
    const lines = [];
    // Remove WEBVTT header and metadata
    const blocks = content.split("\n\n");

    for (const block of blocks) {
      const blockLines = block.trim().split("\n");

      // Find timestamp line (contains -->)
      const timeLine = blockLines.find((l) => l.includes("-->"));
      if (!timeLine) continue;

      // Extract start time
      const timeMatch = timeLine.match(
        /(\d+):(\d+):(\d+\.\d+)|(\d+):(\d+\.\d+)/,
      );
      if (!timeMatch) continue;

      let seconds;
      if (timeMatch[1] !== undefined) {
        // HH:MM:SS.mmm
        seconds =
          parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseFloat(timeMatch[3]);
      } else {
        // MM:SS.mmm
        seconds = parseInt(timeMatch[4]) * 60 + parseFloat(timeMatch[5]);
      }

      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);

      // Get text lines (after timestamp line)
      const textLines = blockLines
        .slice(blockLines.indexOf(timeLine) + 1)
        .map((l) =>
          l
            .replace(/<[^>]+>/g, "") // Remove HTML tags like <c>
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim(),
        )
        .filter((l) => l.length > 0);

      if (textLines.length > 0) {
        const text = textLines.join(" ");
        lines.push(`[${m}:${String(s).padStart(2, "0")}] ${text}`);
      }
    }

    // Remove duplicate lines (VTT often has overlapping captions)
    const seen = new Set();
    return lines
      .filter((line) => {
        const text = line.split("] ")[1];
        if (seen.has(text)) return false;
        seen.add(text);
        return true;
      })
      .join("\n");
  }
}
