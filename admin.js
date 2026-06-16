const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const mongoose = require("./db");
const Admin = require("./Admin");
const { createSession, clearSession, requireAuth } = require("./auth");

const fallbackAdmin = {
  username: "admin",
  password: bcrypt.hashSync("admin123", 10),
  fullName: "Administrator",
  _id: "local-admin",
};

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const isDatabaseConnected = mongoose.connection && mongoose.connection.readyState === 1;
  let admin = null;

  if (isDatabaseConnected) {
    admin = await Admin.findOne({ username });
  }

  const isFallbackLogin = !isDatabaseConnected && username === fallbackAdmin.username && password === "admin123";

  if ((admin && bcrypt.compareSync(password, admin.password)) || isFallbackLogin) {
    const loginUser = admin || fallbackAdmin;
    createSession({ username: loginUser.username, _id: loginUser._id, fullName: loginUser.fullName || loginUser.username }, "admin", res);
    return res.json({ success: true, admin: { username: loginUser.username, fullName: loginUser.fullName || loginUser.username } });
  }

  res.json({ success: false, message: "Invalid credentials" });
});

router.post("/logout", requireAuth(["admin"]), (req, res) => {
  clearSession(req, res);
  res.status(200).json({ success: true, message: "Logged out" });
});

router.get("/me", requireAuth(["admin"]), (req, res) => {
  res.json({ success: true, user: req.user });
});

router.put("/profile", requireAuth(["admin"]), async (req, res) => {
  try {
    const { currentPassword, newPassword, username, fullName } = req.body;
    const admin = await Admin.findById(req.user._id);

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    if (!bcrypt.compareSync(currentPassword || "", admin.password)) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    const nextUsername = (username || "").trim() || admin.username;
    const nextFullName = (fullName || "").trim() || admin.fullName || admin.username;

    if (nextUsername !== admin.username) {
      const existingAdmin = await Admin.findOne({ username: nextUsername });
      if (existingAdmin && existingAdmin._id.toString() !== admin._id.toString()) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }
    }

    admin.username = nextUsername;
    admin.fullName = nextFullName;

    if (newPassword) {
      admin.password = bcrypt.hashSync(newPassword, 10);
    }

    await admin.save();

    req.user.username = admin.username;
    req.user.fullName = admin.fullName;

    res.json({ success: true, admin: { username: admin.username, fullName: admin.fullName || admin.username } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;