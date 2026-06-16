const mongoose = require("../../db");

const settingSchema = new mongoose.Schema({
  tuitionName: { type: String, default: "Tuition Center" },
  contactNumber: { type: String, default: "" },
  address: { type: String, default: "" },
  feeAmount: { type: Number, default: 0 },
  academicYear: { type: String, default: "2025-2026" },
  maxStudents: { type: Number, default: 200 },
  emailEnabled: { type: Boolean, default: false },
  emailServiceId: { type: String, default: "" },
  emailTemplateId: { type: String, default: "" },
  emailPublicKey: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Setting", settingSchema);
