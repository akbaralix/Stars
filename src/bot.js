require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const express = require("express");
const botManager = require("./runtime/botManager");
const connectDatabase = require("../beckend/db");
const Kanal = require("../beckend/Kanal");
const Order = require("../beckend/Order");
const BotModel = require("../beckend/Bot");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Stars bot tizimi ishga tushgan va ishlayapti.");
});

app.listen(PORT, () => {
  console.log(`Express server ishlayapti: http://localhost:${PORT}`);
});

(async () => {
  try {
    await connectDatabase();
    await Promise.all([
      Kanal.syncIndexes(),
      Order.syncIndexes(),
      BotModel.syncIndexes(),
    ]);

    const primaryDoc = await botManager.ensurePrimaryBot(
      process.env.BOT_TOKEN,
      process.env.ADMIN_ID,
      process.env.STARS_PRICE,
    );

    await botManager.launchBot(primaryDoc);
    await botManager.launchStoredBots(primaryDoc._id);

    const runtime = botManager.getRuntime(String(primaryDoc._id));
    const me = await runtime.bot.getMe();
    console.log(`Telegram bot ishga tushdi: @${me.username}`);
  } catch (error) {
    console.error("Botlarni ishga tushirishda xato:", error);
  }
})();
