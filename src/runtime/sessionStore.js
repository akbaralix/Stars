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

module.exports = {
  getSession,
  setSession,
  clearSession,
};
