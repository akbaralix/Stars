// db/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  botId: { type: String, required: true, index: true, default: "main" },
  ownerId: { type: Number, default: null },
  orderId: { type: String, unique: true },
  userId: { type: Number, required: true },
  username: String,
  gift: { type: String, required: true },
  price: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
