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
  const hour = new Date().getHours();
  if (hour >= 20 || hour < 6) {
    return "🌙 Hayrli kech";
  }
  // Kun: 06:00 - 19:59
  else {
    return "☀️ Hayrli kun";
  }
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  getGreeting,
};
