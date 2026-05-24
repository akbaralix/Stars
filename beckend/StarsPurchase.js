const mongoose = require("mongoose");

const starsPurchaseSchema = new mongoose.Schema({
  botId: { type: String, required: true, index: true, default: "main" },
  requestId: { type: String, required: true, unique: true },
  requesterId: { type: Number, required: true },
  requesterUsername: { type: String, default: "" },
  requesterFirstName: { type: String, default: "" },
  recipientType: { type: String, enum: ["self", "other"], required: true },
  recipientUsername: { type: String, required: true },
  starsAmount: { type: Number, required: true },
  paymentAmount: { type: Number, required: true },
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("StarsPurchase", starsPurchaseSchema);
