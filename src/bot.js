const TelegramBot = require("node-telegram-bot-api");
const BOT_TOKEN = "8314219682:AAHjFcE1Ssb96D2Nmf1fNMcjQMvJnUYK2fw";
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

require("../beckend/db");
require("./handlers/start")(bot);
require("./callback/callback")(bot);
require("./handlers/admin")(bot);

console.log("🤖 Bot ishga tushdi");
