import Session from "../models/session.model.js";
import Participant from "../models/participant.model.js";
import Response from "../models/response.model.js";
import Question from "../models/question.model.js";

// --- HELPER: SLEEP FUNCTION ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- HELPER: THE AUTOMATIC GAME LOOP ---
// This runs in the background once the game starts
const runGameLoop = async (sessionCode, io) => {
  console.log(`🚀 Starting Game Loop for ${sessionCode}`);

  try {
    // 1. Fetch all questions for this session (Optimized with .lean())
    const questions = await Question.find({ sessionId: sessionCode })
      .sort({ createdAt: 1 })
      .lean(); // 🟢 LIGHTWEIGHT QUERY

    if (questions.length === 0) {
      console.log("No questions found.");
      io.to(sessionCode).emit("game:error", "No questions in this quiz!");
      return;
    }

    // 2. Loop through every question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const timeLimit = 15; // ⏱️ 15 Seconds per question

      console.log(`📤 Sending Question ${i + 1}: ${question.questionText}`);

      // A. UPDATE DB (So late joiners know what's happening)
      await Session.updateOne(
        { sessionCode },
        {
          currentQuestionId: question._id,
          questionEndsAt: new Date(Date.now() + timeLimit * 1000),
        },
      );

      // B. EMIT QUESTION TO PHONES
      io.to(sessionCode).emit("game:question", {
        qNum: i + 1,
        total: questions.length,
        time: timeLimit,
        question: {
          _id: question._id,
          questionText: question.questionText,
          options: question.options.map((o) => ({ text: o.text })), // 🔒 Hide Correct Answer
        },
      });

      // C. WAIT FOR TIMER (The "Thinking" Phase)
      await sleep(timeLimit * 1000);

      // D. EMIT RESULT (Show correct answer)
      const correctOption = question.options.find((o) => o.isCorrect);
      io.to(sessionCode).emit("game:result", {
        correctAnswer: correctOption ? correctOption.text : "N/A",
      });

      // 🟢 E. UPDATE RANKS (OPTIMIZED - SEND TOP 10)
      // Uses .lean() for speed and .limit(10) for network safety
      const participants = await Participant.find({ sessionId: sessionCode })
        .sort({ totalScore: -1 })
        .limit(10) // 🟢 LIMIT TO TOP 10
        .select("name totalScore")
        .lean();

      const rankList = participants.map((p, idx) => ({
        id: p._id.toString(), // Ensure ID is string
        rank: idx + 1,
        name: p.name,
        score: p.totalScore,
      }));

      io.to(sessionCode).emit("game:ranks", rankList);

      // F. WAIT FOR BREAK (The "Celebration" Phase)
      await sleep(5000); // 5 Seconds break before next question
    }

    // 3. GAME OVER
    console.log(`🏁 Game Over for ${sessionCode}`);
    await Session.updateOne({ sessionCode }, { status: "FINISHED" });

    // Calculate final winners (Top 3)
    const winners = await Participant.find({ sessionId: sessionCode })
      .sort({ totalScore: -1 })
      .limit(3)
      .lean(); // 🟢 LIGHTWEIGHT QUERY

    io.to(sessionCode).emit("game:over", {
      winners: winners.map((w) => ({ name: w.name, score: w.totalScore })),
    });
  } catch (error) {
    console.error("Game Loop Error:", error);
  }
};

/* =========================================================
   CONTROLLERS
========================================================= */

// 1. CREATE SESSION
export const createSession = async (req, res, next) => {
  try {
    const { title, description, sessionCode } = req.body;
    const code = sessionCode.toUpperCase();

    const existing = await Session.findOne({ sessionCode: code });
    if (existing) {
      return res.status(400).json({ success: false, message: "Code exists." });
    }

    const session = await Session.create({
      title,
      description,
      sessionCode: code,
      status: "WAITING",
    });

    res
      .status(201)
      .json({ success: true, message: "Session created", data: session });
  } catch (error) {
    next(error);
  }
};

// 2. GET ALL SESSIONS
export const getAllSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ status: { $ne: "DELETED" } }).sort({
      createdAt: -1,
    });
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (error) {
    next(error);
  }
};

// 3. GET SINGLE SESSION
export const getSessionByCode = async (req, res, next) => {
  try {
    const { sessionCode } = req.params;
    const session = await Session.findOne({
      sessionCode: sessionCode.toUpperCase(),
      status: { $ne: "DELETED" },
    });
    if (!session)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

// 4. 🟢 START GAME (TRIGGERS THE LOOP)
export const startGame = async (req, res, next) => {
  try {
    const { sessionCode } = req.body;
    const io = req.app.get("io");
    const code = sessionCode.toUpperCase();

    // 1. Check if already active
    const existing = await Session.findOne({ sessionCode: code });
    if (existing.status === "ACTIVE") {
      return res
        .status(400)
        .json({ success: false, message: "Game already running!" });
    }

    // 2. Update DB
    const session = await Session.findOneAndUpdate(
      { sessionCode: code },
      { status: "ACTIVE", startTime: new Date() },
      { new: true },
    );

    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });

    // 3. Notify Clients "Game Started" (Move to /play)
    io.to(code).emit("game:started");

    // 4. 🚀 FIRE AND FORGET THE GAME LOOP
    // We do NOT await this, so the response returns immediately to the Admin
    runGameLoop(code, io);

    res.json({ success: true, message: "Game Loop Initiated!", data: session });
  } catch (error) {
    next(error);
  }
};

// 5. UPDATE STATUS (Manual Stop/Reset)
export const updateSessionStatus = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;

    const session = await Session.findByIdAndUpdate(
      sessionId,
      { status },
      { new: true },
    );
    if (!session)
      return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, message: `Status: ${status}`, data: session });
  } catch (error) {
    next(error);
  }
};

// 6. DELETE SESSION
export const deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);
    if (!session)
      return res.status(404).json({ success: false, message: "Not found" });

    const { sessionCode, _id } = session;
    const participants = await Participant.find({
      $or: [{ sessionId: sessionCode }, { sessionId: _id }],
    }).select("_id");
    const participantIds = participants.map((p) => p._id);

    await Promise.all([
      Session.findByIdAndDelete(_id),
      Participant.deleteMany({ _id: { $in: participantIds } }),
      Question.deleteMany({
        $or: [{ sessionId: sessionCode }, { sessionId: _id }],
      }),
      Response.deleteMany({
        $or: [
          { sessionId: sessionCode },
          { sessionId: _id },
          { participantId: { $in: participantIds } },
        ],
      }),
    ]);

    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    next(error);
  }
};

// 7. RESET DATA
export const resetSessionData = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const io = req.app.get("io");
    const session = await Session.findById(sessionId);
    if (!session)
      return res.status(404).json({ success: false, message: "Not found" });

    const participants = await Participant.find({
      sessionId: session.sessionCode,
    }).select("_id");
    const participantIds = participants.map((p) => p._id);

    await Response.deleteMany({ participantId: { $in: participantIds } });
    await Response.deleteMany({ sessionId: sessionId });
    await Participant.deleteMany({ _id: { $in: participantIds } });

    session.status = "WAITING";
    session.currentQuestionId = null;
    await session.save();

    if (io) io.to(session.sessionCode).emit("session:reset");

    res.json({ success: true, message: "Reset complete" });
  } catch (error) {
    next(error);
  }
};

// 8. PERMANENT DELETE
export const deleteSessionPermanently = async (req, res, next) => {
  try {
    const { sessionCode } = req.params;
    const code = sessionCode.toUpperCase();
    const session = await Session.findOne({ sessionCode: code });
    if (!session)
      return res.status(404).json({ success: false, message: "Not found" });

    // 🟢 TRIGGER CLIENT REDIRECT
    req.app.get("io")?.to(code).emit("game:force_stop");

    const questions = await Question.find({ sessionId: code }).select("_id");
    const participants = await Participant.find({ sessionId: code }).select(
      "_id",
    );
    const questionIds = questions.map((q) => q._id);
    const participantIds = participants.map((p) => p._id);

    await Promise.all([
      Response.deleteMany({
        $or: [
          { questionId: { $in: questionIds } },
          { participantId: { $in: participantIds } },
        ],
      }),
      Participant.deleteMany({ sessionId: code }),
      Question.deleteMany({ sessionId: code }),
      Session.deleteOne({ sessionCode: code }),
    ]);

    res.json({ success: true, message: "Permanently deleted" });
  } catch (err) {
    next(err);
  }
};
