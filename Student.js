const mongoose = require("./db");

const StudentSchema = new mongoose.Schema({
  studentId: {
    type: Number,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  className: {
    type: String,
    required: true,
  },
  section: {
    type: String,
    required: true,
  },
  father: {
    type: String,
    default: "",
  },
  mother: {
    type: String,
    default: "",
  },
  phone: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    default: "Active",
  },
  feeAmount: {
    type: Number,
    default: 0,
  },
  parentEmail: {
    type: String,
    default: "",
  },
  lastPaymentDate: {
    type: Date,
    default: null,
  },
  nextPaymentDate: {
    type: Date,
    default: null,
  },
  lastReminderSentAt: {
    type: Date,
    default: null,
  },
  feeBalance: {
    type: Number,
    default: 0,
  },
  photo: {
    type: String,
    default: "",
  },
  subjects: {
    type: [String],
    default: [],
  },
  classDaysPerWeek: {
    type: String,
    default: "",
  },
  preferredTeachingTime: {
    type: String,
    default: "",
  },
  timetable: {
    type: String,
    default: "",
  },
  suspendedFrom: {
    type: [Date],
    default: [],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Student", StudentSchema);