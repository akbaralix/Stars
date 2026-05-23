const mongoose = require("mongoose");

const DB_URI = process.env.DATABASE;

async function connectDatabase() {
  await mongoose.connect(DB_URI);
  console.log("MongoDB-ga muvaffaqiyatli ulanildi!");
  return mongoose;
}

module.exports = connectDatabase;
