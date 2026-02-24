import { logger } from "../utils/logger.js";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const TRANSCRIPT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.transcriptCache = new Map();
    this.languagePrefs = new Map();
    setInterval(() => this._cleanup(), 30 * 60 * 1000);
  }

  setSession(chatId, data) {
    this.sessions.set(chatId, { ...data, createdAt: Date.now() });
  }

  getSession(chatId) {
    const s = this.sessions.get(chatId);
    if (!s) return null;
    if (Date.now() - s.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(chatId);
      return null;
    }
    return s;
  }

  updateSession(chatId, updates) {
    const s = this.sessions.get(chatId);
    if (s) this.sessions.set(chatId, { ...s, ...updates });
  }

  clearSession(chatId) {
    this.sessions.delete(chatId);
  }

  setLanguage(chatId, lang) {
    this.languagePrefs.set(chatId, lang);
    this.updateSession(chatId, { language: lang });
  }

  getLanguage(chatId) {
    return this.languagePrefs.get(chatId) || "en";
  }

  cacheTranscript(videoId, data) {
    this.transcriptCache.set(videoId, { ...data, cachedAt: Date.now() });
    logger.info(`Transcript cached for: ${videoId}`);
  }

  getCachedTranscript(videoId) {
    const c = this.transcriptCache.get(videoId);
    if (!c) return null;
    if (Date.now() - c.cachedAt > TRANSCRIPT_TTL_MS) {
      this.transcriptCache.delete(videoId);
      return null;
    }
    return c;
  }

  _cleanup() {
    const now = Date.now();
    for (const [id, s] of this.sessions)
      if (now - s.createdAt > SESSION_TTL_MS) this.sessions.delete(id);
    for (const [id, c] of this.transcriptCache)
      if (now - c.cachedAt > TRANSCRIPT_TTL_MS) this.transcriptCache.delete(id);
  }
}
