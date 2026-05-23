const mongoose = require("mongoose");

const botSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  botTelegramId: { type: Number, unique: true, sparse: true },
  username: { type: String, required: true },
  title: { type: String, default: "" },
  ownerId: { type: Number, required: true, index: true },
  ownerUsername: { type: String, default: "" },
  starsPrice: { type: Number, default: 3 },
  isPrimary: { type: Boolean, default: false },
  proPurchasedAt: { type: Date, default: null },
  proExpiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Bot", botSchema);
