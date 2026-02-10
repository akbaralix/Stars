const mongoose = require("mongoose");

mongoose
  .connect(
    "mongodb+srv://tursunboyevakbarali807_db_user:Lrgz4WnzECP0SQCH@cluster0.14rzz6g.mongodb.net/?appName=Cluster0",
  )
  .then(() => console.log("MongoDB-ga muvaffaqiyatli ulanildi! ✅"))
  .catch((err) => console.error("DB ulanishda xatolik:", err));

module.exports = mongoose;
