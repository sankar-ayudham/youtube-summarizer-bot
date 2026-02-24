const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL =
  LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;

function formatMessage(level, ...args) {
  const timestamp = new Date().toISOString();
  return [`[${timestamp}] [${level.toUpperCase()}]`, ...args].join(" ");
}

export const logger = {
  debug: (...args) => {
    if (CURRENT_LEVEL <= 0) console.debug(formatMessage("debug", ...args));
  },
  info: (...args) => {
    if (CURRENT_LEVEL <= 1) console.log(formatMessage("info", ...args));
  },
  warn: (...args) => {
    if (CURRENT_LEVEL <= 2) console.warn(formatMessage("warn", ...args));
  },
  error: (...args) => {
    if (CURRENT_LEVEL <= 3) console.error(formatMessage("error", ...args));
  },
};
