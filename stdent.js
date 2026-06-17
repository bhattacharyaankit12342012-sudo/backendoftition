const express = require("express");
const router = express.Router();

const Student = require("./Student");
const { requireAuth } = require("./auth");

function buildTimetableText(student) {
  const days = String(student.classDaysPerWeek || "")
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean);
  const time = student.preferredTeachingTime || "Not set";
  const subjects = Array.isArray(student.subjects) && student.subjects.length
    ? student.subjects.join(", ")
    : "None";

  return `Student ID: ${student.studentId || ""}\nStudent Name: ${student.name || "Student"}\nTeaching Time: ${time}\nDays: ${days.length ? days.join(", ") : "Not set"}\nSubjects: ${subjects}`;
}

router.post("/add", requireAuth(["admin"]), async (req, res) => {
  try {
    const subjects = Array.isArray(req.body.subjects) ? req.body.subjects : [];
    const classDaysPerWeek = Array.isArray(req.body.classDaysPerWeek)
      ? req.body.classDaysPerWeek.join(", ")
      : (req.body.classDaysPerWeek || "");
    const preferredTeachingTime = req.body.preferredTeachingTime || "";

    const lastStudent = await Student.findOne().sort({ studentId: -1 });
    let nextId = 1;
    if (lastStudent) {
      nextId = lastStudent.studentId + 1;
    }

    const student = new Student({
      studentId: nextId,
      name: req.body.name,
      className: req.body.className,
      section: req.body.section,
      father: req.body.father,
      mother: req.body.mother,
      phone: req.body.phone,
      status: req.body.status,
      feeAmount: Number(req.body.feeAmount || 0),
      parentEmail: req.body.parentEmail || "",
      subjects,
      classDaysPerWeek,
      preferredTeachingTime,
      timetable: buildTimetableText({
        studentId: nextId,
        name: req.body.name,
        classDaysPerWeek,
        preferredTeachingTime,
        subjects,
      }),
    });

    await student.save();
    res.json({ success: true, message: "Student Added", student });
  } catch (err) {
    console.log(err);
    res.json({ success: false, error: err.message });
  }
});

router.get("/all", requireAuth(["admin"]), async (req, res) => {
  const students = await Student.find().sort({ studentId: 1 });
  res.json(students);
});

router.get("/:studentId", requireAuth(["admin", "parent"]), async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: Number(req.params.studentId) });
    if (!student) {
      return res.json({ success: false, message: "Student Not Found" });
    }

    if (req.sessionType === "parent" && Number(req.user.studentId) !== Number(req.params.studentId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.json({ success: true, student });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.put("/:studentId", requireAuth(["admin"]), async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: Number(req.params.studentId) });
    if (!student) {
      return res.json({ success: false, message: "Student not found" });
    }

    const subjects = Array.isArray(req.body.subjects) ? req.body.subjects : (student.subjects || []);
    const classDaysPerWeek = Array.isArray(req.body.classDaysPerWeek)
      ? req.body.classDaysPerWeek.join(", ")
      : (req.body.classDaysPerWeek || student.classDaysPerWeek || "");
    const preferredTeachingTime = req.body.preferredTeachingTime || student.preferredTeachingTime || "";

    student.name = req.body.name || student.name;
    student.className = req.body.className || student.className;
    student.section = req.body.section || student.section;
    student.father = req.body.father || student.father;
    student.mother = req.body.mother || student.mother;
    student.phone = req.body.phone || student.phone;
    student.status = req.body.status || student.status;
    student.photo = req.body.photo || student.photo || "";
    student.feeAmount = Number(req.body.feeAmount || student.feeAmount || 0);
    student.parentEmail = req.body.parentEmail || student.parentEmail || "";
    student.subjects = subjects;
    student.classDaysPerWeek = classDaysPerWeek;
    student.preferredTeachingTime = preferredTeachingTime;
    student.timetable = req.body.timetable || buildTimetableText({
      studentId: student.studentId,
      name: student.name,
      classDaysPerWeek,
      preferredTeachingTime,
      subjects,
    });

    await student.save();
    res.json({ success: true, student });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.delete("/:studentId", requireAuth(["admin"]), async (req, res) => {
  try {
    await Student.deleteOne({ studentId: Number(req.params.studentId) });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.put("/status/:studentId", requireAuth(["admin"]), async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { studentId: Number(req.params.studentId) },
      { status: req.body.status },
      { new: true }
    );

    if (!student) {
      return res.json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, student });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;