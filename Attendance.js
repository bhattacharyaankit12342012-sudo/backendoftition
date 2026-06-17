const mongoose = require("./db");

const attendanceSchema = new mongoose.Schema({
  studentId: { type: Number, required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ["Present", "Absent", "Leave", "Suspended"], default: "Present" },
  note: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
