const mongoose = require("mongoose");

const kanalSchema = new mongoose.Schema({
  kanalURL: { type: String, require: true },
  kanalNomi: { type: String, require: true },
  kanalId: { type: String, require: true },
});

module.exports = mongoose.model("Kanal", kanalSchema);
