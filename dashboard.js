const express = require("express");
const router = express.Router();
const Student = require("./Student");
const Payment = require("./Payment");
const LeaveRequest = require("./LeaveRequest");
const Attendance = require("./Attendance");
const Message = require("./Message");
const Setting = require("./Setting");
const { requireAuth } = require("./auth");

const formatDateOnly = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toISOString().split("T")[0];
};

const sendReminderEmail = async (student, settings) => {
  if (!student?.parentEmail) {
    throw new Error("Student has no parent email set.");
  }

  if (!settings?.emailEnabled || !settings?.emailServiceId || !settings?.emailTemplateId || !settings?.emailPublicKey) {
    throw new Error("EmailJS settings are incomplete.");
  }

  const dueDate = student.nextPaymentDate ? new Date(student.nextPaymentDate) : null;
  const response = await fetch(`https://api.emailjs.com/api/v1/service/${settings.emailServiceId}/email/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: settings.emailServiceId,
      template_id: settings.emailTemplateId,
      user_id: settings.emailPublicKey,
      template_params: {
        to_name: student.name || "Parent",
        parent_email: student.parentEmail,
        student_name: student.name || "Student",
        student_id: student.studentId,
        fee_amount: Number(student.feeAmount || 0),
        due_date: dueDate ? dueDate.toLocaleDateString("en-GB") : "N/A",
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EmailJS request failed: ${response.status} ${text}`);
  }

  student.lastReminderSentAt = new Date();
  await student.save();
};

router.get("/stats", requireAuth(["admin"]), async (req, res) => {
  try {
    const [students, payments, leaveRequests, messages, settings] = await Promise.all([
      Student.find(),
      Payment.find(),
      LeaveRequest.find(),
      Message.find(),
      Setting.findOne(),
    ]);

    const totalStudents = students.length;
    const activeStudents = students.filter((s) => s.status === "Active").length;
    const inactiveStudents = students.filter((s) => s.status === "Inactive").length;
    const expelledStudents = students.filter((s) => s.status === "Expelled").length;
    const stoppedStudents = students.filter((s) => s.status === "Stopped").length;
    const totalFeesCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const pendingFees = students.reduce((sum, student) => {
      const paid = payments.filter((p) => p.studentId === student.studentId).reduce((acc, p) => acc + (p.amount || 0), 0);
      const feeAmount = settings?.feeAmount || 0;
      return sum + Math.max(0, feeAmount - paid);
    }, 0);

    res.json({
      success: true,
      stats: {
        totalStudents,
        activeStudents,
        inactiveStudents,
        expelledStudents,
        stoppedStudents,
        totalFeesCollected,
        pendingFees,
        leaveRequests: leaveRequests.length,
        messages: messages.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/payments", requireAuth(["admin"]), async (req, res) => {
  try {
    const payment = await Payment.create(req.body);
    const student = await Student.findOne({ studentId: Number(req.body.studentId) });
    if (student) {
      const paymentDate = new Date(req.body.date || payment.date || Date.now());
      student.lastPaymentDate = paymentDate;
      student.nextPaymentDate = new Date(paymentDate);
      student.nextPaymentDate.setMonth(student.nextPaymentDate.getMonth() + 1);
      student.feeAmount = Number(student.feeAmount || req.body.amount || 0);
      await student.save();
    }
    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/payments/:studentId", requireAuth(["admin", "parent"]), async (req, res) => {
  try {
    const payments = await Payment.find({ studentId: Number(req.params.studentId) }).sort({ date: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/attendance", requireAuth(["admin"]), async (req, res) => {
  try {
    const attendance = await Attendance.create(req.body);
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/attendance", requireAuth(["admin"]), async (req, res) => {
  try {
    const attendance = await Attendance.find().sort({ date: -1 });
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/attendance/:studentId", requireAuth(["admin", "parent"]), async (req, res) => {
  try {
    const attendance = await Attendance.find({ studentId: Number(req.params.studentId) }).sort({ date: 1 });
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/leave-requests", requireAuth(["parent"]), async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.user.studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const dateValue = req.body.date || req.body.dates?.[0];
    if (!dateValue) {
      return res.status(400).json({ success: false, message: "A leave date is required" });
    }

    const leaveRequest = await LeaveRequest.create({
      studentId: req.user.studentId,
      date: new Date(dateValue),
      reason: req.body.reason || "Leave request",
      approvedDates: Array.isArray(req.body.dates) ? req.body.dates.map((d) => new Date(d)) : [new Date(dateValue)],
    });

    res.json({ success: true, leaveRequest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/leave-requests", requireAuth(["admin", "parent"]), async (req, res) => {
  try {
    const query = req.sessionType === "parent" ? { studentId: req.user.studentId } : {};
    const leaveRequests = await LeaveRequest.find(query).sort({ createdAt: -1 });
    res.json({ success: true, leaveRequests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/leave-requests/:id", requireAuth(["admin"]), async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    const previousStatus = leaveRequest.status;
    leaveRequest.status = req.body.status;
    leaveRequest.approvedDates = Array.isArray(req.body.approvedDates) && req.body.approvedDates.length
      ? req.body.approvedDates.map((d) => new Date(d))
      : leaveRequest.approvedDates;
    await leaveRequest.save();

    if (previousStatus === "Approved" && req.body.status !== "Approved") {
      const student = await Student.findOne({ studentId: leaveRequest.studentId });
      if (student) {
        const suspendedDates = (student.suspendedFrom || []).filter((value) => formatDateOnly(value) !== formatDateOnly(leaveRequest.date));
        student.suspendedFrom = suspendedDates;
        await student.save();
      }
      await Attendance.deleteMany({ studentId: leaveRequest.studentId, note: new RegExp(`Suspended from ${formatDateOnly(leaveRequest.date)}`, "i") });
    }

    if (req.body.status === "Approved") {
      const approvedDates = Array.isArray(leaveRequest.approvedDates) && leaveRequest.approvedDates.length
        ? leaveRequest.approvedDates
        : [leaveRequest.date];

      for (const approvedDate of approvedDates) {
        await Attendance.findOneAndUpdate(
          { studentId: leaveRequest.studentId, date: new Date(approvedDate) },
          { status: "Suspended", note: `Suspended from ${formatDateOnly(approvedDate)}` },
          { upsert: true, new: true }
        );
      }

      const student = await Student.findOne({ studentId: leaveRequest.studentId });
      if (student) {
        const existing = new Set((student.suspendedFrom || []).map((item) => formatDateOnly(item)));
        approvedDates.forEach((approvedDate) => existing.add(formatDateOnly(approvedDate)));
        student.suspendedFrom = Array.from(existing).map((value) => new Date(value));
        await student.save();
      }
    }

    res.json({ success: true, leaveRequest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/messages", requireAuth(["parent"]), async (req, res) => {
  try {
    const message = await Message.create({ studentId: req.user.studentId, message: req.body.message });
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/messages", requireAuth(["admin", "parent"]), async (req, res) => {
  try {
    const query = req.sessionType === "parent" ? { studentId: req.user.studentId } : {};
    const messages = await Message.find(query).sort({ createdAt: -1 });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/messages/:id/resolve", requireAuth(["admin"]), async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true });
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/reminders/send/:studentId", requireAuth(["admin"]), async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: Number(req.params.studentId) });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const settings = await Setting.findOne();
    if (!settings) {
      return res.status(400).json({ success: false, message: "EmailJS settings are not configured yet. Save them in Settings first." });
    }

    await sendReminderEmail(student, settings);
    res.json({ success: true, message: "Reminder email sent successfully" });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/settings", requireAuth(["admin"]), async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/settings", requireAuth(["admin"]), async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    Object.assign(settings, req.body);
    await settings.save();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
