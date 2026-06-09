const sessions = new Map();

function makeKey(botId, chatId) {
  return `${botId}:${chatId}`;
}

function getSession(botId, chatId) {
  return sessions.get(makeKey(botId, chatId));
}

function setSession(botId, chatId, payload) {
  sessions.set(makeKey(botId, chatId), payload);
}

function clearSession(botId, chatId) {
  sessions.delete(makeKey(botId, chatId));
}
function getGreeting() {
  const hour = new Date().toLocaleString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    hour: "numeric",
    hour12: false,
  });

  const h = Number(hour);
  if (h >= 20 || h < 6) {
    return "🌙 Hayrli kech";
  } else {
    return "☀️ Hayrli kun";
  }
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  getGreeting,
};
