const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  username: String,
  balance: { type: Number, default: 0 },
  totalInvited: { type: Number, default: 0 },
  isSubscribed: { type: Boolean, default: false },
  invitedBy: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
