import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";
import express from "express";
import cors from "cors";
import dns from "dns";

// 1. IMPORT MODELS
import Question from "./models/question.model.js";
import Session from "./models/session.model.js";
import Participant from "./models/participant.model.js";

// 2. IMPORT ROUTES (Make sure these files exist!)

import adminRoutes from "./routes/admin.routes.js";

import participantRoutes from "./routes/participant.routes.js";
import sessionRoutes from "./routes/session.routes.js"; // Needed for Admin
import questionRoutes from "./routes/question.routes.js"; // Needed for Admin

// Fix for some network environments
dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();

/* ================= APP SETUP ================= */
const app = express();

// ✅ CORS: Allow connections from ANYWHERE (Cloud & Localhost)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json());

// Basic Route to check if server is running
app.get("/", (req, res) => {
  res.send("GDG Quiz Backend is Running 🚀");
});

/* ================= ROUTES (THE FIX) ================= */
// 🚨 THESE WERE COMMENTED OUT - I ENABLED THEM
app.use("/api/admin", adminRoutes);
app.use("/api/participants", participantRoutes); // <--- This fixes the 404 for Users!
app.use("/api/sessions", sessionRoutes); // <--- This keeps Admin working
app.use("/api/questions", questionRoutes); // <--- This keeps Questions working

/* ================= DATABASE ================= */
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gdg-quiz";

mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(async () => {
    console.log("✅ MongoDB Connected");
    // Reset stuck sessions
    await Session.updateMany(
      { status: "ACTIVE" },
      { currentQuestionId: null, questionEndsAt: null },
    );
    console.log("🔄 Session recovery done");
  })
  .catch((err) => console.error("❌ Mongo Error:", err.message));

/* ================= SOCKET SERVER ================= */
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all frontend connections
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

const activeGames = new Map();

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("join:session", (code) => {
    if (code) {
      const cleanCode = String(code).trim().toUpperCase();
      socket.join(cleanCode);
      console.log(`User ${socket.id} joined room: ${cleanCode}`);
    }
  });

  socket.on("sync:state", async (sessionCode) => {
    try {
      const code = String(sessionCode).trim().toUpperCase();
      const session = await Session.findOne({ sessionCode: code });

      if (!session || !session.currentQuestionId || !session.questionEndsAt) {
        socket.emit("sync:idle");
        return;
      }

      const remaining = Math.floor(
        (session.questionEndsAt.getTime() - Date.now()) / 1000,
      );

      if (remaining <= 0) {
        socket.emit("sync:idle");
        return;
      }

      const q = await Question.findById(session.currentQuestionId);
      if (!q) return;

      socket.emit("game:question", {
        question: {
          _id: q._id,
          questionText: q.questionText,
          options: q.options.map((o) => ({ text: o.text })),
        },
        time: remaining,
        isSync: true,
      });
    } catch (e) {
      console.error("❌ Sync error:", e);
    }
  });

  // GAME START HANDLER
  socket.on("admin:start_game", async (sessionCode) => {
    try {
      const code = String(sessionCode).trim().toUpperCase();
      console.log(`🚀 Admin requested start for: ${code}`);

      if (activeGames.has(code)) {
        console.log(`⚠️ Game ${code} ALREADY RUNNING.`);
        return;
      }

      const session = await Session.findOne({ sessionCode: code });
      if (!session) return console.error("❌ Session not found");

      if (session.status !== "ACTIVE") {
        await Session.updateOne(
          { sessionCode: code },
          { status: "ACTIVE", startTime: new Date() },
        );
      }

      activeGames.set(code, true);
      io.to(code).emit("game:started");

      const questions = await Question.find({ sessionId: code }).sort({
        order: 1,
      });

      if (!questions.length) {
        console.error("❌ No questions found.");
        activeGames.delete(code);
        return;
      }

      await runGameLoop(io, code, questions);
      activeGames.delete(code);
      console.log(`LG Game finished: ${code}`);
    } catch (e) {
      activeGames.delete(String(sessionCode).trim().toUpperCase());
      console.error("❌ Start Game Error:", e);
    }
  });
});

/* ================= GAME LOOP ================= */
async function runGameLoop(io, room, questions) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    try {
      const checkSession = await Session.findOne({ sessionCode: room }).select(
        "status",
      );
      if (!checkSession || checkSession.status !== "ACTIVE") {
        console.log("🛑 Game STOPPED. Exiting loop.");
        io.to(room).emit("game:over");
        break;
      }

      console.log(`👉 Question ${i + 1}/${questions.length}`);

      await Session.findOneAndUpdate(
        { sessionCode: room },
        {
          currentQuestionId: q._id,
          questionEndsAt: new Date(Date.now() + 15000),
        },
      );

      io.to(room).emit("game:question", {
        question: {
          _id: q._id,
          questionText: q.questionText,
          options: (q.options || []).map((o) => ({ text: o.text })),
        },
        qNum: i + 1,
        total: questions.length,
        time: 15,
      });

      await sleep(15000); // Wait 15s for answer

      const correctOpt = q.options ? q.options.find((o) => o.isCorrect) : null;
      io.to(room).emit("game:result", {
        correctAnswer: correctOpt ? correctOpt.text : "Error: No Answer",
      });

      // Calculate Ranks
      try {
        const allPlayers = await Participant.find({ sessionId: room })
          .sort({ totalScore: -1 })
          .lean();
        const rankList = allPlayers.map((p, index) => ({
          id: String(p._id),
          rank: index + 1,
          score: p.totalScore || 0,
          name: p.name,
        }));
        io.to(room).emit("game:ranks", rankList);
      } catch (err) {
        console.error("⚠️ Rank Calc Warning:", err.message);
      }

      await Session.findOneAndUpdate(
        { sessionCode: room },
        { currentQuestionId: null, questionEndsAt: null },
      );

      io.to(room).emit("leaderboard:update");
      await sleep(5000); // Cooldown
    } catch (err) {
      console.error(`❌ Question Error:`, err);
      await sleep(3000);
      continue;
    }
  }

  // GAME OVER
  const finalCheck = await Session.findOne({ sessionCode: room }).select(
    "status",
  );
  if (finalCheck && finalCheck.status === "ACTIVE") {
    const winners = await Participant.find({ sessionId: room })
      .sort({ totalScore: -1 })
      .limit(3)
      .select("name totalScore")
      .lean();
    await Session.findOneAndUpdate(
      { sessionCode: room },
      { status: "COMPLETED" },
    );
    io.to(room).emit("game:over", { winners });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`),
);
