import { isYouTubeUrl, extractVideoId } from "../utils/urlParser.js";
import { TranscriptService } from "../services/transcriptService.js";
import { AIService } from "../services/aiService.js";
import { logger } from "../utils/logger.js";

const transcriptService = new TranscriptService();
const aiService = new AIService();

export async function handleMessage(
  bot,
  msg,
  sessionManager,
  commandType = null,
) {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  // ── Language switch ─────────────────────────────────────────────────────
  const langMatch = text.match(
    /(?:summarize|explain|respond|answer|talk)\s+in\s+(hindi|हिंदी|tamil|telugu|kannada|marathi)/i,
  );
  if (langMatch) {
    const map = {
      hindi: "hi",
      हिंदी: "hi",
      tamil: "ta",
      telugu: "te",
      kannada: "kn",
      marathi: "mr",
    };
    const lang = map[langMatch[1].toLowerCase()] || "en";
    sessionManager.setLanguage(chatId, lang);
    await bot.sendMessage(
      chatId,
      lang === "hi"
        ? "✅ भाषा हिंदी में बदल दी गई! 🇮🇳"
        : `✅ Language switched! I'll now respond in ${langMatch[1]}.`,
    );
    const session = sessionManager.getSession(chatId);
    if (session?.transcript)
      await sendSummary(bot, chatId, session, sessionManager, aiService);
    return;
  }

  // ── YouTube link ────────────────────────────────────────────────────────
  if (isYouTubeUrl(text)) {
    const videoId = extractVideoId(text);
    if (!videoId) {
      await bot.sendMessage(
        chatId,
        "❌ Could not read that URL. Please try again.",
      );
      return;
    }

    // Check cache
    const cached = sessionManager.getCachedTranscript(videoId);
    if (cached) {
      sessionManager.setSession(chatId, {
        videoId,
        transcript: cached.transcript,
        videoTitle: cached.videoTitle,
        language: sessionManager.getLanguage(chatId),
      });
      await bot.sendMessage(chatId, "⚡ Found in cache! Generating summary...");
      await sendSummary(
        bot,
        chatId,
        sessionManager.getSession(chatId),
        sessionManager,
        aiService,
      );
      return;
    }

    const loading = await bot.sendMessage(
      chatId,
      "⏳ *Fetching transcript...*",
      { parse_mode: "Markdown" },
    );
    try {
      const { transcript, videoTitle } =
        await transcriptService.fetchTranscript(videoId);
      sessionManager.cacheTranscript(videoId, { transcript, videoTitle });
      sessionManager.setSession(chatId, {
        videoId,
        transcript,
        videoTitle,
        language: sessionManager.getLanguage(chatId),
      });
      await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
      await sendSummary(
        bot,
        chatId,
        sessionManager.getSession(chatId),
        sessionManager,
        aiService,
      );
    } catch (err) {
      await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
      logger.error("Transcript error:", err.message);
      await bot.sendMessage(chatId, `❌ *Error:* ${err.message}`, {
        parse_mode: "Markdown",
      });
    }
    return;
  }

  // ── Commands ────────────────────────────────────────────────────────────
  if (commandType === "deepdive" || commandType === "actionpoints") {
    const session = sessionManager.getSession(chatId);
    const loading = await bot.sendMessage(
      chatId,
      commandType === "deepdive"
        ? "🔬 Doing deep analysis..."
        : "📋 Extracting action points...",
    );
    try {
      const result =
        commandType === "deepdive"
          ? await aiService.deepDive(session.transcript, session.language)
          : await aiService.extractActionPoints(
              session.transcript,
              session.language,
            );
      await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
      await bot.sendMessage(chatId, result, { parse_mode: "Markdown" });
    } catch {
      await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
      await bot.sendMessage(
        chatId,
        "❌ Something went wrong. Please try again.",
      );
    }
    return;
  }

  // ── Q&A ─────────────────────────────────────────────────────────────────
  const session = sessionManager.getSession(chatId);
  if (!session?.transcript) {
    await bot.sendMessage(
      chatId,
      "👋 Send me a YouTube link to get started!\n\nExample:\nhttps://youtube.com/watch?v=dQw4w9WgXcQ",
    );
    return;
  }

  await bot.sendChatAction(chatId, "typing");
  try {
    const answer = await aiService.answerQuestion(
      text,
      session.transcript,
      session.videoTitle,
      session.language,
    );
    await bot.sendMessage(chatId, answer, { parse_mode: "Markdown" });
  } catch {
    await bot.sendMessage(chatId, "❌ Error answering. Please try again.");
  }
}

async function sendSummary(bot, chatId, session, sessionManager, aiService) {
  const loading = await bot.sendMessage(chatId, "🧠 *Generating summary...*", {
    parse_mode: "Markdown",
  });
  try {
    const summary = await aiService.generateSummary(
      session.transcript,
      session.videoTitle,
      session.language,
    );
    sessionManager.updateSession(chatId, { summary });
    await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
    await bot.sendMessage(chatId, summary, { parse_mode: "Markdown" });
    await bot.sendMessage(
      chatId,
      "💬 *Now ask me anything about this video!*\n_Example: What did they say about money?_",
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
    await bot.sendMessage(
      chatId,
      `❌ Error generating summary: ${err.message}`,
    );
  }
}
