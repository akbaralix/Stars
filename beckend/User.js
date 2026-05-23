const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  botId: { type: String, required: true, index: true, default: "main" },
  telegramId: { type: Number, required: true },
  firstName: String,
  username: String,
  balance: { type: Number, default: 0 },
  totalInvited: { type: Number, default: 0 },
  isSubscribed: { type: Boolean, default: false },
  invitedBy: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});

userSchema.index({ telegramId: 1 }, { unique: true });

function normalizeBotId(botId) {
  return String(botId || "main").replace(/[^a-zA-Z0-9]/g, "_");
}

function getUserModel(botId) {
  const safeBotId = normalizeBotId(botId);
  const modelName = `User_${safeBotId}`;
  const collectionName = `users_${safeBotId}`;

  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }

  return mongoose.model(modelName, userSchema, collectionName);
}

async function syncUserIndexes(botId) {
  const UserModel = getUserModel(botId);
  await UserModel.syncIndexes();
  return UserModel;
}

module.exports = {
  getUserModel,
  syncUserIndexes,
};
