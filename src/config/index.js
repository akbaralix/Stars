const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  TON_ADDRESS: process.env.TON_ADDRESS,
};
