const mongoose = require("./db");

const messageSchema = new mongoose.Schema({
  studentId: { type: Number, required: true },
  message: { type: String, required: true },
  date: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
