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

userSchema.index({ botId: 1, telegramId: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
