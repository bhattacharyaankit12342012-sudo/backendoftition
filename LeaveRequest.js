const mongoose = require("./db");

const leaveRequestSchema = new mongoose.Schema({
  studentId: { type: Number, required: true },
  date: { type: Date, required: true },
  reason: { type: String, default: "" },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  parentMessage: { type: String, default: "" },
  approvedDates: { type: [Date], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
