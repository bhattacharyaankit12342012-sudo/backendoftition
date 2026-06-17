const express = require("express");
const router = express.Router();
const Student = require("./Student");
const { createSession, clearSession, requireAuth } = require("./auth");

router.post("/login", async (req, res) => {
  const { name, id } = req.body;
  const student = await Student.findOne({ name, studentId: Number(id) });

  if (student) {
    createSession({ name: student.name, studentId: student.studentId, _id: student._id }, "parent", res);
    return res.json({ success: true, student });
  }

  res.json({ success: false, message: "Student not found" });
});

router.post("/logout", requireAuth(["parent"]), (req, res) => {
  clearSession(req, res);
  res.status(200).json({ success: true, message: "Logged out" });
});

router.get("/me", requireAuth(["parent"]), (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;