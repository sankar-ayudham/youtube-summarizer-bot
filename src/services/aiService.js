import OpenAI from "openai";
import { chunkTranscript } from "../utils/transcriptChunker.js";
import { logger } from "../utils/logger.js";

const LANG_NAMES = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  mr: "Marathi",
};

export class AIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/youtube-summarizer-bot",
        "X-Title": "YouTube Summarizer Bot",
      },
    });
    this.model = "openai/gpt-4o-mini";
  }

  async generateSummary(transcript, videoTitle, language = "en") {
    const lang = LANG_NAMES[language] || "English";
    const text = this._truncate(transcript, 12000);

    return await this._chat(
      `You are an expert YouTube video analyst. Respond ENTIRELY in ${lang}.`,
      `Summarize this YouTube video titled "${videoTitle}".

Transcript:
${text}

Respond in ${lang}. Use this EXACT format:

🎥 *${videoTitle}*

📌 *Key Points*
1. [key point]
2. [key point]
3. [key point]
4. [key point]
5. [key point]

⏱ *Important Timestamps*
- [0:00] – [topic covered]
- [X:XX] – [topic covered]
- [X:XX] – [topic covered]

🧠 *Core Takeaway*
[2-3 sentence summary of the main lesson]

💡 *Best For*
[One sentence: who should watch this]`,
    );
  }

  async answerQuestion(question, transcript, videoTitle, language = "en") {
    const lang = LANG_NAMES[language] || "English";
    const chunks = chunkTranscript(transcript, 8000);
    const relevant = this._bestChunk(chunks, question);
    const notFound =
      language === "hi"
        ? "यह विषय वीडियो में शामिल नहीं है।"
        : "This topic is not covered in the video.";

    return await this._chat(
      `You answer questions about YouTube videos using ONLY the transcript provided.
If the answer is not in the transcript, reply exactly: "${notFound}"
Never make up information. Respond in ${lang}.`,
      `Video: "${videoTitle}"

Transcript:
${relevant}

Question: ${question}

Answer based ONLY on the transcript. Respond in ${lang}.`,
    );
  }

  async deepDive(transcript, language = "en") {
    const lang = LANG_NAMES[language] || "English";
    return await this._chat(
      `You are a deep analysis expert. Respond in ${lang}.`,
      `Do a DEEP DIVE analysis of this transcript. Respond in ${lang}.

Transcript:
${this._truncate(transcript, 10000)}

Use this format:

🔬 *Deep Dive Analysis*

📊 *Main Arguments*
[Key arguments made in the video]

🔍 *Underlying Themes*
[3-5 deeper themes]

⚖️ *Strengths & Gaps*
[What is strong, what is missing]

🎯 *Key Insights*
[Most important insights for the viewer]`,
    );
  }

  async extractActionPoints(transcript, language = "en") {
    const lang = LANG_NAMES[language] || "English";
    return await this._chat(
      `You extract practical action items from video content. Respond in ${lang}.`,
      `Extract all action items from this transcript. Respond in ${lang}.

Transcript:
${this._truncate(transcript, 10000)}

Use this format:

📋 *Action Points*

🚀 *Do Today*
- [action]
- [action]

📅 *This Week*
- [action]
- [action]

🎯 *Long Term*
- [action]

💰 *Biggest Quick Win*
[The single most impactful thing to do right now]`,
    );
  }

  async _chat(systemPrompt, userPrompt) {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.4,
      });
      return res.choices[0].message.content.trim();
    } catch (err) {
      logger.error("AI error:", err.message);
      throw new Error(`AI error: ${err.message}`);
    }
  }

  _truncate(text, max) {
    if (text.length <= max) return text;
    const half = Math.floor(max / 2);
    return (
      text.slice(0, half) + "\n\n[...middle trimmed...]\n\n" + text.slice(-half)
    );
  }

  _bestChunk(chunks, question) {
    if (chunks.length === 1) return chunks[0];
    const words = question
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    let best = chunks[0],
      score = 0;
    for (const chunk of chunks) {
      const s = words.reduce(
        (a, w) => a + (chunk.toLowerCase().includes(w) ? 1 : 0),
        0,
      );
      if (s > score) {
        score = s;
        best = chunk;
      }
    }
    return best;
  }
}
