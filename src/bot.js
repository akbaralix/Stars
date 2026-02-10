require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🤖 AkaStarsBot ishga tushgan va ishlayapti!");
});

app.listen(PORT, () => {
  console.log(`🌐 Express server ishlayapti: http://localhost:${PORT}`);
});

require("../beckend/db");

require("./handlers/start")(bot);
require("./callback/callback")(bot);
require("./handlers/admin")(bot);

console.log("🤖 Telegram Bot ishga tushdi");
