const mongoose = require("mongoose");

const DB_URI = process.env.DATABASE;

mongoose
  .connect(DB_URI)
  .then(() => console.log("MongoDB-ga muvaffaqiyatli ulanildi! ✅"))
  .catch((err) => console.error("DB ulanishda xatolik:", err));

module.exports = mongoose;
