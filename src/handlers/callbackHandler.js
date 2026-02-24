export async function handleCallbackQuery(bot, query, sessionManager) {
  const chatId = query.message.chat.id;
  const data = query.data;
  await bot.answerCallbackQuery(query.id);

  if (data.startsWith("lang_")) {
    const lang = data.replace("lang_", "");
    const names = {
      en: "English 🇬🇧",
      hi: "Hindi 🇮🇳",
      ta: "Tamil",
      te: "Telugu",
      kn: "Kannada",
      mr: "Marathi",
    };
    sessionManager.setLanguage(chatId, lang);
    await bot.sendMessage(
      chatId,
      lang === "hi"
        ? "✅ भाषा *हिंदी* में सेट हो गई! अब मैं हिंदी में जवाब दूंगा 🇮🇳"
        : `✅ Language set to *${names[lang] || lang}*!`,
      { parse_mode: "Markdown" },
    );
  }
}
