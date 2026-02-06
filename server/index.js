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

// 2. IMPORT ROUTES
import adminRoutes from "./routes/admin.routes.js";
import participantRoutes from "./routes/participant.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import questionRoutes from "./routes/question.routes.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dotenv.config();

/* ================= APP SETUP ================= */
const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("GDG Quiz Backend is Running 🚀");
});

/* ================= ROUTES ================= */
app.use("/api/admin", adminRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/questions", questionRoutes);

/* ================= DATABASE ================= */
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gdg-quiz";
mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(async () => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ Mongo Error:", err.message));

/* ================= SOCKET SERVER ================= */
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  // 🟢 1. JOIN ROOM (UPDATED FOR LATE JOINERS)
  socket.on("join:session", async (code) => {
    if (code) {
      const cleanCode = String(code).trim().toUpperCase();
      socket.join(cleanCode);
      socket.currentRoom = cleanCode;

      console.log(`User ${socket.id} joined room: ${cleanCode}`);

      // Broadcast Count
      const roomSize = io.sockets.adapter.rooms.get(cleanCode)?.size || 0;
      io.to(cleanCode).emit("session:update", { count: roomSize });

      // 🟢 CHECK STATUS: If game is already ACTIVE, tell this user to move to /play
      try {
        const session = await Session.findOne({
          sessionCode: cleanCode,
        }).select("status");
        if (session && session.status === "ACTIVE") {
          console.log(`⏩ Late joiner ${socket.id} redirected to Play`);
          socket.emit("game:started"); // Triggers router.push('/play') on frontend
        }
      } catch (e) {
        console.error("Join Error:", e);
      }
    }
  });

  // 2. SYNC STATE (Handles Question/Leaderboard display in /play)
  socket.on("sync:state", async (sessionCode) => {
    try {
      const code = String(sessionCode).trim().toUpperCase();
      const session = await Session.findOne({ sessionCode: code });

      if (!session) {
        return socket.emit("error", "Session not found");
      }

      // A. IF WAITING (Lobby)
      if (session.status === "WAITING") {
        socket.emit("sync:idle");
        return;
      }

      // B. IF FINISHED
      if (session.status === "FINISHED") {
        socket.emit("game:over", {});
        return;
      }

      // C. IF ACTIVE (Check Timer)
      const now = new Date();
      const endsAt = new Date(session.questionEndsAt);
      const remaining = Math.ceil((endsAt.getTime() - now.getTime()) / 1000);

      // Case 1: Question is RUNNING (Time > 0) -> Send Question
      if (session.currentQuestionId && remaining > 0) {
        console.log(`⚡ Syncing Question (Time: ${remaining}s)`);

        const q = await Question.findById(session.currentQuestionId).lean();
        if (!q) return;

        const allQuestions = await Question.find({ sessionId: code })
          .sort({ createdAt: 1 })
          .select("_id")
          .lean();
        const currentIdx = allQuestions.findIndex(
          (x) => x._id.toString() === q._id.toString(),
        );

        socket.emit("game:question", {
          qNum: currentIdx + 1,
          total: allQuestions.length,
          time: remaining, // Send Partial Time
          question: {
            _id: q._id,
            questionText: q.questionText,
            options: q.options.map((o) => ({ text: o.text })),
          },
          isSync: true,
        });
        return;
      }

      // Case 2: In BREAK / RESULT Phase -> Send Leaderboard
      console.log(`⏸️ Syncing Leaderboard`);

      const topPlayers = await Participant.find({ sessionId: code })
        .sort({ totalScore: -1 })
        .limit(10)
        .select("name totalScore")
        .lean();

      socket.emit(
        "game:ranks",
        topPlayers.map((p, idx) => ({
          id: p._id.toString(),
          rank: idx + 1,
          name: p.name,
          score: p.totalScore,
        })),
      );
    } catch (e) {
      console.error("❌ Sync error:", e);
    }
  });

  // 3. DISCONNECT
  socket.on("disconnect", () => {
    if (socket.currentRoom) {
      const roomCode = socket.currentRoom;
      const roomSize = io.sockets.adapter.rooms.get(roomCode)?.size || 0;
      io.to(roomCode).emit("session:update", { count: roomSize });
    }
    console.log("❌ Disconnected:", socket.id);
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`),
);
