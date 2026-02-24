import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { handleMessage } from "./handlers/messageHandler.js";
import { handleCallbackQuery } from "./handlers/callbackHandler.js";
import { SessionManager } from "./services/sessionManager.js";
import { logger } from "./utils/logger.js";

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing from .env file!");
  process.exit(1);
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const sessionManager = new SessionManager();

// ── /start ──────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `👋 *Welcome ${msg.from.first_name || ""}!*\n\n` +
      `I'm your YouTube AI Assistant 🤖\n\n` +
      `*How to use:*\n` +
      `1️⃣ Paste any YouTube link\n` +
      `2️⃣ Get a structured summary\n` +
      `3️⃣ Ask questions about the video!\n\n` +
      `*Commands:*\n` +
      `/summary – Show last summary\n` +
      `/deepdive – Deep analysis\n` +
      `/actionpoints – Get action items\n` +
      `/language – Switch language\n` +
      `/clear – Start over\n` +
      `/help – Help\n\n` +
      `_Paste a YouTube link to begin!_ 🚀`,
    { parse_mode: "Markdown" },
  );
});

// ── /help ───────────────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `*📖 How to use this bot*\n\n` +
      `*Step 1:* Paste a YouTube link\n` +
      `*Step 2:* Get your summary\n` +
      `*Step 3:* Ask any question!\n\n` +
      `*Language:* Type "Summarize in Hindi" or "Explain in Tamil"\n\n` +
      `*Commands:*\n` +
      `/summary – Re-show last summary\n` +
      `/deepdive – Deep analysis\n` +
      `/actionpoints – Action items\n` +
      `/language – Language menu\n` +
      `/clear – Clear session\n`,
    { parse_mode: "Markdown" },
  );
});

// ── /clear ──────────────────────────────────────────────────────────────────
bot.onText(/\/clear/, async (msg) => {
  sessionManager.clearSession(msg.chat.id);
  await bot.sendMessage(
    msg.chat.id,
    "🗑️ Session cleared! Send a new YouTube link.",
  );
});

// ── /language ───────────────────────────────────────────────────────────────
bot.onText(/\/language/, async (msg) => {
  await bot.sendMessage(msg.chat.id, "🌐 Choose your language:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇬🇧 English", callback_data: "lang_en" },
          { text: "🇮🇳 Hindi", callback_data: "lang_hi" },
        ],
        [
          { text: "Tamil", callback_data: "lang_ta" },
          { text: "Telugu", callback_data: "lang_te" },
        ],
        [
          { text: "Kannada", callback_data: "lang_kn" },
          { text: "Marathi", callback_data: "lang_mr" },
        ],
      ],
    },
  });
});

// ── /summary ─────────────────────────────────────────────────────────────────
bot.onText(/\/summary/, async (msg) => {
  const session = sessionManager.getSession(msg.chat.id);
  if (!session?.summary) {
    await bot.sendMessage(
      msg.chat.id,
      "❌ No summary yet. Send a YouTube link first!",
    );
    return;
  }
  await bot.sendMessage(msg.chat.id, session.summary, {
    parse_mode: "Markdown",
  });
});

// ── /deepdive ────────────────────────────────────────────────────────────────
bot.onText(/\/deepdive/, async (msg) => {
  const session = sessionManager.getSession(msg.chat.id);
  if (!session?.transcript) {
    await bot.sendMessage(
      msg.chat.id,
      "❌ No video loaded. Send a YouTube link first!",
    );
    return;
  }
  await handleMessage(bot, msg, sessionManager, "deepdive");
});

// ── /actionpoints ─────────────────────────────────────────────────────────────
bot.onText(/\/actionpoints/, async (msg) => {
  const session = sessionManager.getSession(msg.chat.id);
  if (!session?.transcript) {
    await bot.sendMessage(
      msg.chat.id,
      "❌ No video loaded. Send a YouTube link first!",
    );
    return;
  }
  await handleMessage(bot, msg, sessionManager, "actionpoints");
});

// ── All other messages ────────────────────────────────────────────────────────
bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return;
  await handleMessage(bot, msg, sessionManager);
});

// ── Button clicks ─────────────────────────────────────────────────────────────
bot.on("callback_query", async (query) => {
  await handleCallbackQuery(bot, query, sessionManager);
});

// ── Errors ────────────────────────────────────────────────────────────────────
bot.on("polling_error", (err) => logger.error("Polling error:", err.message));
process.on("unhandledRejection", (err) => logger.error("Unhandled:", err));

logger.info("🤖 YouTube Summarizer Bot is running...");
