import express from "express";
import Participant from "../models/participant.model.js"; // 🟢 Import Model for Stats

const router = express.Router();

// 1. VERIFY PASSCODE (Login)
router.post("/verify-passcode", (req, res) => {
  // Get passcode from headers OR body
  const passcode = req.headers["admin-passcode"] || req.body["admin-passcode"];
  const SYSTEM_PASSCODE = process.env.ADMIN_PASSCODE || "12345";

  if (passcode === SYSTEM_PASSCODE) {
    return res.status(200).json({
      success: true,
      message: "Login Successful",
    });
  } else {
    return res.status(403).json({
      success: false,
      message: "Invalid Passcode",
    });
  }
});

// 2. 🟢 GET STATS (For Admin Dashboard)
router.get("/stats", async (req, res) => {
  try {
    // Count all participants across all sessions
    const userCount = await Participant.countDocuments({});

    // You can add more stats here later (e.g., activeSessions, totalQuestions)
    res.json({
      success: true,
      userCount: userCount,
    });
  } catch (e) {
    console.error("Stats Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
