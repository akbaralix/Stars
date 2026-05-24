const mongoose = require("mongoose");

const topUpSchema = new mongoose.Schema({
  botId: { type: String, required: true, index: true, default: "main" },
  requestId: { type: String, required: true, unique: true },
  userId: { type: Number, required: true },
  username: { type: String, default: "" },
  firstName: { type: String, default: "" },
  starsAmount: { type: Number, required: true },
  paymentAmount: { type: Number, required: true },
  receiptType: { type: String, required: true },
  receiptFileId: { type: String, required: true },
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("TopUp", topUpSchema);
