const mongoose = require("./db");

const paymentSchema = new mongoose.Schema({
  studentId: { type: Number, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  method: { type: String, default: "Cash" },
  note: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
