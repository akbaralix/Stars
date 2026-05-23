const TelegramBot = require("node-telegram-bot-api");

const BotModel = require("../../beckend/Bot");
const { syncUserIndexes } = require("../../beckend/User");
const registerStartHandlers = require("../handlers/start");
const registerCallbackHandlers = require("../callback/callback");
const registerAdminHandlers = require("../handlers/admin");

const activeBots = new Map();

function getBotKey(botDoc) {
  return String(botDoc._id);
}

function getRuntime(botId) {
  return activeBots.get(String(botId));
}

function getAllRuntimes() {
  return [...activeBots.values()];
}

async function attachHandlers(bot, botDoc) {
  const context = {
    botId: getBotKey(botDoc),
    ownerId: Number(botDoc.ownerId),
    isPrimary: Boolean(botDoc.isPrimary),
    starsPrice: Number(botDoc.starsPrice) || 0,
    username: botDoc.username,
    title: botDoc.title,
  };

  registerStartHandlers(bot, context, module.exports);
  registerCallbackHandlers(bot, context, module.exports);
  registerAdminHandlers(bot, context, module.exports);
}

async function launchBot(botDoc) {
  const botId = getBotKey(botDoc);
  if (activeBots.has(botId)) {
    return activeBots.get(botId);
  }

  const bot = new TelegramBot(botDoc.token, { polling: true });
  const me = await bot.getMe();

  botDoc.botTelegramId = me.id;
  botDoc.username = me.username;
  botDoc.title = me.first_name || botDoc.title;
  await botDoc.save();
  await syncUserIndexes(botId);

  await attachHandlers(bot, botDoc);

  const runtime = { bot, botDoc };
  activeBots.set(botId, runtime);
  return runtime;
}

async function validateToken(token) {
  const tempBot = new TelegramBot(token, { polling: false });
  try {
    const me = await tempBot.getMe();
    return { ok: true, me };
  } catch (error) {
    return { ok: false, error };
  } finally {
    tempBot.closeWebHook().catch(() => {});
  }
}

async function createAndLaunchBot({ token, owner, starsPrice }) {
  const existing = await BotModel.findOne({ token });
  if (existing) {
    return { exists: true, botDoc: existing };
  }

  const validation = await validateToken(token);
  if (!validation.ok) {
    return { invalid: true };
  }

  const botDoc = await BotModel.create({
    token,
    botTelegramId: validation.me.id,
    username: validation.me.username,
    title: validation.me.first_name || "",
    ownerId: owner.id,
    ownerUsername: owner.username || "",
    starsPrice: Number(starsPrice) || 0,
    isPrimary: false,
  });

  await launchBot(botDoc);
  return { created: true, botDoc };
}

async function ensurePrimaryBot(token, ownerId, defaultStarsPrice) {
  const tempBot = new TelegramBot(token, { polling: false });
  const me = await tempBot.getMe();
  await tempBot.closeWebHook().catch(() => {});

  let botDoc = await BotModel.findOne({ token });
  if (!botDoc) {
    botDoc = await BotModel.create({
      token,
      botTelegramId: me.id,
      username: me.username,
      title: me.first_name || "",
      ownerId: Number(ownerId),
      starsPrice: Number(defaultStarsPrice) || 0,
      isPrimary: true,
    });
  } else {
    botDoc.ownerId = Number(ownerId);
    botDoc.isPrimary = true;
    botDoc.starsPrice = Number(botDoc.starsPrice) || Number(defaultStarsPrice) || 0;
    botDoc.botTelegramId = me.id;
    botDoc.username = me.username;
    botDoc.title = me.first_name || botDoc.title;
    await botDoc.save();
  }

  return botDoc;
}

async function launchStoredBots(skipBotId) {
  const bots = await BotModel.find({ isPrimary: false });
  for (const botDoc of bots) {
    if (skipBotId && String(botDoc._id) === String(skipBotId)) {
      continue;
    }

    try {
      await launchBot(botDoc);
    } catch (error) {
      console.error(`Bot ishga tushmadi @${botDoc.username}:`, error.message);
    }
  }
}

async function updateStarsPrice(botId, starsPrice) {
  const botDoc = await BotModel.findById(botId);
  if (!botDoc) return null;

  botDoc.starsPrice = Number(starsPrice) || 0;
  await botDoc.save();

  const runtime = getRuntime(botId);
  if (runtime) {
    runtime.botDoc.starsPrice = botDoc.starsPrice;
  }

  return botDoc;
}

async function updateBotDocument(botId, update) {
  const botDoc = await BotModel.findByIdAndUpdate(botId, update, { new: true });
  if (!botDoc) return null;

  const runtime = getRuntime(botId);
  if (runtime) {
    runtime.botDoc = botDoc;
  }

  return botDoc;
}

module.exports = {
  createAndLaunchBot,
  ensurePrimaryBot,
  getAllRuntimes,
  getRuntime,
  launchBot,
  launchStoredBots,
  updateBotDocument,
  updateStarsPrice,
  validateToken,
};
