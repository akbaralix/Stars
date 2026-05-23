const mongoose = require("mongoose");

const kanalSchema = new mongoose.Schema({
  botId: { type: String, required: true, index: true, default: "main" },
  ownerId: { type: Number, default: null },
  kanalURL: { type: String, require: true },
  kanalNomi: { type: String, require: true },
  kanalId: { type: String, require: true },
});

kanalSchema.index({ botId: 1, kanalId: 1 }, { unique: true });

module.exports = mongoose.model("Kanal", kanalSchema);
