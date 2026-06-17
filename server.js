require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const mongoose = require("./db");
// const Admin = require("./routes/models/Admin");
const Admin = require("./Admin");
// const Student = require("./routes/models/Student");
const Student = require("./Student");
// const Setting = require("./routes/models/Setting");
const Setting = require("./Setting");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "routes", "models", "public");
const ALLOWED_ORIGINS = [
  "https://dads-backend-9emf.onrender.com",
  "https://dads-frontend.onrender.com",
  "https://dads.onrender.com",
  "https://localhost",
  "https://127.0.0.1",
  "http://localhost",
  "http://127.0.0.1",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = origin && (ALLOWED_ORIGINS.includes(origin) || origin.includes("render.com") || origin.includes("vercel.app") || origin.includes("onrender.com"));
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());
app.use(express.static(PUBLIC_DIR, { index: false, redirect: false }));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "tuition-management" });
});

app.use("/admin", require("./admin"));
app.use("/parent", require("./parent"));
app.use("/stdents", require("./stdent"));
app.use("/dashboard", require("./dashboard"));

app.get(["/", "/index.html"], (req, res) => {
  res.status(200).sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/*", (req, res, next) => {
  const pathname = req.path.toLowerCase();
  if (pathname.includes(".")) {
    return res.status(404).send("Not Found");
  }
  if (pathname === "/" || pathname === "/index.html") {
    return res.status(200).sendFile(path.join(PUBLIC_DIR, "index.html"));
  }
  res.status(200).sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const isDatabaseReady = () => mongoose.connection && mongoose.connection.readyState === 1;

const ensureDefaultAdmin = async () => {
  try {
    if (!isDatabaseReady()) {
      console.log("Skipping default admin creation because MongoDB is not connected.");
      return;
    }

    const existingAdmin = await Admin.findOne({ username: "admin" });
    if (!existingAdmin) {
      const hashedPassword = bcrypt.hashSync("admin123", 10);
      await Admin.create({ username: "admin", password: hashedPassword, fullName: "Administrator" });
      console.log("Default admin created: admin / admin123");
    }
  } catch (error) {
    console.error("Failed to create default admin:", error.message);
  }
};

const sendPaymentReminders = async () => {
  try {
    if (!isDatabaseReady()) {
      return;
    }

    const settings = await Setting.findOne();
    if (!settings?.emailEnabled || !settings?.emailServiceId || !settings?.emailTemplateId || !settings?.emailPublicKey) {
      return;
    }

    const students = await Student.find({ parentEmail: { $ne: "" }, nextPaymentDate: { $ne: null } });
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    for (const student of students) {
      if (!student.nextPaymentDate) continue;
      const dueDate = new Date(student.nextPaymentDate);
      if (student.lastReminderSentAt && new Date(student.lastReminderSentAt).toDateString() === today.toDateString()) continue;
      if (dueDate.toDateString() !== tomorrow.toDateString()) continue;

      const response = await fetch("https://api.emailjs.com/api/v1/service/" + settings.emailServiceId + "/email/send", {
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
            due_date: dueDate.toLocaleDateString("en-GB"),
          },
        }),
      });

      if (response.ok) {
        student.lastReminderSentAt = new Date();
        await student.save();
      }
    }
  } catch (error) {
    console.error("Reminder email failed:", error.message);
  }
};

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server Running on port ${PORT}`);
  ensureDefaultAdmin();
  sendPaymentReminders();
});

setInterval(sendPaymentReminders, 1000 * 60 * 60 * 6);

const shutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  server.close((err) => {
    if (err) {
      console.error("Error closing server:", err);
      process.exitCode = 1;
    }

    mongoose.disconnect()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));