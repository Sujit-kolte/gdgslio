import Session from "../models/session.model.js";
import Participant from "../models/participant.model.js";
import Response from "../models/response.model.js";
import Question from "../models/question.model.js";

// 1. CREATE SESSION
export const createSession = async (req, res, next) => {
  try {
    const { title, description, sessionCode } = req.body;
    const code = sessionCode.toUpperCase();

    const existing = await Session.findOne({ sessionCode: code });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Session code already exists. Please choose another.",
      });
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
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   4. 🟢 START GAME (The Missing Piece)
   This is called when you click "Start Game" in Admin.
========================================================= */
export const startGame = async (req, res, next) => {
  try {
    const { sessionCode } = req.body;
    const io = req.app.get("io");
    const code = sessionCode.toUpperCase();

    // 1. Update DB to ACTIVE
    const session = await Session.findOneAndUpdate(
      { sessionCode: code },
      { status: "ACTIVE", startTime: new Date() },
      { new: true },
    );

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    // 2. 🟢 EMIT THE CORRECT SIGNAL
    // This matches: socket.on("game:started") in your LobbyPage
    io.to(code).emit("game:started");

    res.json({
      success: true,
      message: "Game Started successfully!",
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

// 5. UPDATE STATUS (General Purpose)
export const updateSessionStatus = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;
    const io = req.app.get("io");

    if (!["WAITING", "ACTIVE", "FINISHED", "COMPLETED"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const updateData = { status };
    if (status === "ACTIVE") updateData.startTime = new Date();

    const session = await Session.findByIdAndUpdate(sessionId, updateData, {
      new: true,
    });
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });

    // 🟢 FIX: Send the correct signal here too, just in case
    if (status === "ACTIVE") {
      io.to(session.sessionCode).emit("game:started");
    }

    res.json({
      success: true,
      message: `Status updated to ${status}`,
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   6. DELETE SESSION
========================================================= */
export const deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    const { sessionCode, _id } = session;
    console.log(`🗑️ Deleting Session: ${sessionCode}`);

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

    res.status(200).json({
      success: true,
      message: "Session and ALL related data deleted.",
    });
  } catch (error) {
    console.error("Delete Error:", error);
    next(error);
  }
};

/* =========================================================
   7. RESET DATA
========================================================= */
export const resetSessionData = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const io = req.app.get("io");

    const session = await Session.findById(sessionId);
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });

    const participants = await Participant.find({
      sessionId: session.sessionCode,
    }).select("_id");
    const participantIds = participants.map((p) => p._id);

    await Response.deleteMany({ participantId: { $in: participantIds } });
    await Response.deleteMany({ sessionId: sessionId });
    await Participant.deleteMany({ _id: { $in: participantIds } });

    session.status = "WAITING";
    session.currentQuestionId = null;
    session.questionEndsAt = null;
    await session.save();

    if (io) io.to(session.sessionCode).emit("session:reset");

    res.json({
      success: true,
      message: "♻️ Session reset! Ready for new players.",
    });
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
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

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

    res.json({
      success: true,
      message: "Session and all related data deleted permanently",
    });
  } catch (err) {
    next(err);
  }
};
