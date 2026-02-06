"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import confetti from "canvas-confetti";

// 🟢 CONFIGURATION
const API_URL = "https://gdgslio.onrender.com/api";

export default function GamePlay() {
  const router = useRouter();
  const socket = getSocket();

  // --- STATE ---
  const [view, setView] = useState("LOADING");
  const [player, setPlayer] = useState({ name: "", score: 0, rank: "--" });

  // Game Data
  const [question, setQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(15);
  const [selectedOption, setSelectedOption] = useState(null);
  const [result, setResult] = useState(null);
  const [winners, setWinners] = useState([]);

  // 🟢 NEW: Leaderboard State for mid-game updates
  const [leaderboard, setLeaderboard] = useState([]);

  // Stats
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, timeout: 0 });

  const timerRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const pId = sessionStorage.getItem("PARTICIPANT_ID");
    const code = sessionStorage.getItem("SESSION_CODE");
    const name = sessionStorage.getItem("PLAYER_NAME");

    if (!pId || !code) {
      router.push("/user");
      return;
    }

    setPlayer((prev) => ({ ...prev, name: name || "Player" }));
    setView("LOBBY");

    // 1. Join & Sync (Run this immediately)
    socket.emit("join:session", code);
    socket.emit("sync:state", code);

    // 🟢 2. LISTENERS
    socket.on("game:question", handleNewQuestion);
    socket.on("game:result", handleResult);
    socket.on("game:ranks", handleRanks);
    socket.on("game:over", handleGameOver);
    socket.on("sync:idle", () => setView("LOBBY"));

    // 🟢 3. FORCE STOP LISTENER (Navigate to Landing Page)
    // 🟢 3. FORCE STOP LISTENER (Navigate to Landing Page)
    socket.on("game:force_stop", () => {
      alert("The host has ended the session.");

      // Clear data so they don't get stuck if they click 'Back'
      sessionStorage.removeItem("SESSION_CODE");
      sessionStorage.removeItem("PARTICIPANT_ID");
      sessionStorage.removeItem("PLAYER_NAME");

      router.push("/");
    });

    // 🟢 4. RECONNECT LISTENER (Auto-Sync if screen sleeps)
    socket.on("connect", () => {
      console.log("♻️ Reconnected! Syncing...");
      socket.emit("join:session", code);
      socket.emit("sync:state", code);
    });

    return () => {
      socket.off("game:question");
      socket.off("game:result");
      socket.off("game:ranks");
      socket.off("game:over");
      socket.off("sync:idle");
      socket.off("game:force_stop");
      socket.off("connect");
      clearInterval(timerRef.current);
    };
  }, []);

  // --- HANDLERS ---
  const handleNewQuestion = (data) => {
    setView("QUESTION");
    setQuestion(data);
    setSelectedOption(null);
    setResult(null);

    // 🟢 FIX: Handle Late Join Time properly
    // If joining late, data.time will be e.g. 8s.
    // We keep totalTime 15s so the circle looks partially empty.
    const duration = data.time !== undefined ? data.time : 15;

    setTotalTime(15);
    setTimeLeft(duration);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResult = (data) => {
    clearInterval(timerRef.current);
    setView("RESULT");
    setResult(data);

    if (data.correctAnswer === selectedOption) {
      triggerConfetti();
    }
  };

  const handleRanks = (rankList) => {
    // 🟢 Save top 10 for display
    setLeaderboard(rankList);

    const pId = sessionStorage.getItem("PARTICIPANT_ID");
    const me = rankList.find((p) => p.id === pId);

    // Update my rank/score if I am in the top list
    if (me) {
      setPlayer((prev) => ({ ...prev, rank: me.rank, score: me.score }));
    }
  };

  const handleGameOver = async (data) => {
    clearInterval(timerRef.current);
    setView("GAMEOVER");

    if (data.winners) setWinners(data.winners);

    triggerConfetti(true);

    try {
      const pId = sessionStorage.getItem("PARTICIPANT_ID");
      const res = await fetch(`${API_URL}/participants/history/${pId}`);
      const json = await res.json();
      if (json.success) {
        const correct = json.data.filter((h) => h.status === "CORRECT").length;
        const incorrect = json.data.filter((h) => h.status === "WRONG").length;
        const timeout =
          json.data.filter((h) => h.status === "TIMEOUT").length || 0;
        setStats({ correct, incorrect, timeout });
      }
    } catch (e) {
      console.error("History Error", e);
    }
  };

  const submitAnswer = async (text) => {
    if (selectedOption) return;
    setSelectedOption(text);

    const pId = sessionStorage.getItem("PARTICIPANT_ID");
    const code = sessionStorage.getItem("SESSION_CODE");

    try {
      await fetch(`${API_URL}/participants/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: pId,
          sessionCode: code,
          questionId: question.question._id,
          selectedOption: text,
          timeLeft: timeLeft,
        }),
      });
    } catch (e) {
      console.error("Submit error", e);
    }
  };

  const triggerConfetti = (big = false) => {
    if (big) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#4285F4", "#34A853", "#FBBC05", "#EA4335"],
      });
    } else {
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    }
  };

  // --- UI CALCS ---
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  // 🟢 Fix: Ensure we don't divide by zero or get negative dash
  const progressRatio = totalTime > 0 ? timeLeft / totalTime : 0;
  const strokeDashoffset = circumference - progressRatio * circumference;

  let timerClass = "timer-circle-progress";
  if (timeLeft <= 3) timerClass += " danger";
  else if (timeLeft <= 5) timerClass += " warning";

  const qNum = question?.qNum || 1;
  const qTotal = question?.total || 1;
  const progressPercent = (qNum / qTotal) * 100;

  if (view === "LOADING")
    return (
      <div className="min-h-screen flex items-center justify-center text-xl font-bold text-gray-500">
        Loading Game...
      </div>
    );

  return (
    <div className="main-body">
      <div className="container">
        <div className="quiz-card">
          {/* === 1. LOBBY === */}
          {view === "LOBBY" && (
            <div className="start-screen">
              <h1>🎯 GDG Quiz</h1>
              <p className="start-screen-subtitle">
                Welcome,{" "}
                <span style={{ color: "#2563eb", fontWeight: "bold" }}>
                  {player.name}
                </span>
                !
              </p>
              <div className="quiz-rules">
                <h3>Waiting for Host...</h3>
                <ul>
                  <li>Keep this screen open.</li>
                  <li>The game will start automatically.</li>
                  <li>Faster answers get more points!</li>
                </ul>
              </div>
              <div
                className="timer-circle-container"
                style={{ margin: "0 auto" }}>
                <div className="timer-number">⏳</div>
              </div>
            </div>
          )}

          {/* === 2. QUESTION VIEW === */}
          {view === "QUESTION" && question && (
            <div id="quizScreen">
              {/* Header / Progress */}
              <div className="progress-container">
                <div className="progress-info">
                  <div className="question-counter">
                    Q {question.qNum} / {question.total}
                  </div>
                  <div className="score-display-top">Score: {player.score}</div>

                  {/* Timer */}
                  <div className="clock-container">
                    <div className="timer-circle-container">
                      <svg
                        className="timer-svg"
                        width="80"
                        height="80"
                        viewBox="0 0 100 100">
                        <circle
                          className="timer-circle-bg"
                          cx="50"
                          cy="50"
                          r="45"></circle>
                        <circle
                          className={timerClass}
                          cx="50"
                          cy="50"
                          r="45"
                          style={{ strokeDashoffset }}></circle>
                      </svg>
                      <div className="timer-text">
                        <div className="timer-number">{timeLeft}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>

              <div className="question-container">
                <div className="question-text">
                  {question.question.questionText}
                </div>
                <div className="answers-grid">
                  {question.question.options.map((opt, idx) => {
                    const label = String.fromCharCode(65 + idx);
                    const isSelected = selectedOption === opt.text;
                    return (
                      <button
                        key={idx}
                        className={`answer-btn ${isSelected ? "selected-answer" : ""}`}
                        data-option={label}
                        onClick={() => submitAnswer(opt.text)}
                        disabled={!!selectedOption}>
                        {opt.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* === 3. RESULT VIEW === */}
          {view === "RESULT" && result && (
            <div className="results-container">
              <div className="trophy-container" style={{ fontSize: "4em" }}>
                {selectedOption === result.correctAnswer
                  ? "🎉"
                  : selectedOption
                    ? "❌"
                    : "⏰"}
              </div>

              <h2 className="complete-title" style={{ marginBottom: "10px" }}>
                {selectedOption === result.correctAnswer ? (
                  <span style={{ color: "#34A853" }}>Correct!</span>
                ) : (
                  <span style={{ color: "#EA4335" }}>Wrong!</span>
                )}
              </h2>

              <div
                className="performance-message"
                style={{ marginBottom: "20px" }}>
                Correct Answer:{" "}
                <strong style={{ color: "#333" }}>
                  {result.correctAnswer}
                </strong>
              </div>

              {/* Rank & Score Stats */}
              <div className="stats-row" style={{ marginBottom: "20px" }}>
                <div
                  className="mini-stat"
                  style={{ background: "#e8f0fe", borderColor: "#4285F4" }}>
                  <div className="stat-num" style={{ color: "#4285F4" }}>
                    {player.score}
                  </div>
                  <div className="stat-text">Score</div>
                </div>
                <div
                  className="mini-stat"
                  style={{ background: "#fef9c3", borderColor: "#facc15" }}>
                  <div className="stat-num" style={{ color: "#b45309" }}>
                    #{player.rank}
                  </div>
                  <div className="stat-text">Current Rank</div>
                </div>
              </div>
            </div>
          )}

          {/* === 4. GAMEOVER VIEW === */}
          {view === "GAMEOVER" && (
            <div className="results-container">
              <div className="trophy-icon">🏆</div>
              <h2 className="complete-title">Quiz Complete!</h2>

              {/* Final Leaderboard */}
              <div className="leaderboard-card">
                <div className="leaderboard-header">Top Winners</div>
                <div className="leaderboard-list">
                  {winners.length > 0 ? (
                    winners.map((w, idx) => {
                      let rankClass = "";
                      if (idx === 0) rankClass = "gold";
                      else if (idx === 1) rankClass = "silver";
                      else if (idx === 2) rankClass = "bronze";

                      return (
                        <div key={idx} className={`leader-item ${rankClass}`}>
                          <span>
                            #{idx + 1} {w.name}
                          </span>
                          <span className="pts">{w.score} pts</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="leader-item">
                      <span>Calculating...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Your Performance Card */}
              <div className="performance-card">
                <div className="perf-label">Your Performance</div>
                <div className="rank-value">
                  Rank: <span>#{player.rank}</span>
                </div>
                <div className="accuracy-label">Score: {player.score} pts</div>
              </div>

              {/* Stats Grid */}
              <div className="stats-row">
                <div className="mini-stat" id="mini1">
                  <div className="stat-num correct-val">{stats.correct}</div>
                  <div className="stat-text">Correct</div>
                </div>
                <div className="mini-stat" id="mini2">
                  <div className="stat-num incorrect-val">
                    {stats.incorrect}
                  </div>
                  <div className="stat-text">Incorrect</div>
                </div>
                <div className="mini-stat" id="mini3">
                  <div className="stat-num timeout-val">{stats.timeout}</div>
                  <div className="stat-text">Timeouts</div>
                </div>
              </div>

              <button className="restart-btn" onClick={() => router.push("/")}>
                Exit to Home
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        .main-body {
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          background-color: #fbfbfc;
          background-image:
            linear-gradient(
              to right,
              rgba(8, 75, 162, 0.12) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(8, 75, 162, 0.12) 1px,
              transparent 1px
            );
          background-size: 40px 40px;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .container {
          max-width: 800px;
          width: 100%;
        }
        .quiz-card {
          background: white;
          border-radius: 20px;
          box-shadow:
            0 25px 45px rgba(17, 0, 56, 0.25),
            0 15px 25px rgba(16, 0, 37, 0.1);
          padding: 40px;
          position: relative;
          border: 1px solid rgba(14, 1, 29, 0.1);
          min-height: 500px;
        }

        .timer-circle-container {
          position: relative;
          width: 80px;
          height: 80px;
        }
        .timer-svg {
          position: absolute;
          top: 0;
          left: 0;
        }
        .timer-circle-bg {
          fill: none;
          stroke: #e0e0e0;
          stroke-width: 4;
        }
        .timer-circle-progress {
          fill: none;
          stroke: #4285f4;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-dasharray: 282.7;
          transition: stroke-dashoffset 1s linear;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
        }
        .timer-circle-progress.warning {
          stroke: #f39c12;
        }
        .timer-circle-progress.danger {
          stroke: #eb3349;
        }
        .timer-text {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .timer-number {
          font-size: 1.8em;
          font-weight: 700;
          color: #34a853;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .progress-container {
          margin-bottom: 30px;
        }
        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .progress-bar {
          width: 100%;
          height: 10px;
          background: #e0e0e0;
          border-radius: 10px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #34a853;
          transition: width 0.5s ease;
        }
        .question-counter {
          background: #ea4335;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
        }
        .score-display-top {
          color: #34a853;
          font-weight: 600;
          padding: 8px 16px;
          background: rgba(52, 168, 83, 0.1);
          border-radius: 20px;
        }

        .question-text {
          font-size: 1.5em;
          color: #333;
          margin-bottom: 30px;
          font-weight: 600;
          text-align: center;
        }
        .answers-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .answer-btn {
          padding: 20px;
          border: 2px solid #a4b1ff;
          background: white;
          border-radius: 12px;
          font-size: 1.1em;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .answer-btn::before {
          content: attr(data-option);
          width: 30px;
          height: 30px;
          background: #4285f4;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .answer-btn:hover {
          background: #f8f9ff;
        }
        .selected-answer {
          background: #e0f2fe;
          border-color: #2563eb;
        }

        .start-screen,
        .results-container {
          text-align: center;
          animation: fadeIn 1s ease forwards;
        }
        .complete-title {
          color: #4285f4;
          font-size: 2.2em;
          margin-bottom: 25px;
          font-weight: 800;
        }
        .trophy-icon,
        .trophy-container {
          font-size: 4em;
          margin-bottom: 10px;
          display: inline-block;
          animation: pulseZoom 2s ease-in-out infinite;
        }

        .leaderboard-card {
          border: 4px solid #9eabf5;
          border-radius: 15px;
          padding: 15px;
          margin-bottom: 25px;
        }
        .leaderboard-header {
          font-weight: 800;
          margin-bottom: 12px;
          font-size: 0.9em;
          color: #333;
        }

        /* 🟢 NEW: Scrollable List Logic */
        .leaderboard-list {
          max-height: 250px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: #4285f4 #f1f1f1;
        }

        .leader-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 15px;
          margin-bottom: 8px;
          border-radius: 8px;
          font-weight: 700;
          border: 1px solid #141414;
        }
        .leader-item.gold {
          background-color: #fff8e1;
          border-color: #ffc107;
        }
        .leader-item.silver {
          background-color: #f5f5f5;
          border-color: #9e9e9e;
        }
        .leader-item.bronze {
          background-color: #fbe9e7;
          border-color: #ff7043;
        }

        .performance-card {
          background: #4285f4;
          color: white;
          border-radius: 15px;
          padding: 25px;
          margin-bottom: 25px;
          border: 2px solid #141414;
        }
        .perf-label {
          font-size: 0.9em;
          font-weight: 600;
          opacity: 0.9;
        }
        .rank-value {
          font-size: 2.5em;
          font-weight: 900;
          margin: 5px 0;
        }
        .accuracy-label {
          font-size: 1em;
          font-weight: 600;
          opacity: 0.9;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }
        .mini-stat {
          background: #f8f9fa;
          border: 1px solid #111111;
          padding: 15px 5px;
          border-radius: 12px;
        }
        .stat-num {
          font-size: 1.8em;
          font-weight: 800;
          display: block;
          animation: pulseZoom1 2s ease-in-out infinite;
        }
        .stat-text {
          font-size: 0.75em;
          color: #666;
          font-weight: 600;
        }

        #mini1 {
          background-color: #bce5c7;
          border: 2px solid #34a853;
        }
        #mini2 {
          background-color: #e7bdbd;
          border: 2px solid #ea4335;
        }
        #mini3 {
          background-color: #ecddb1;
          border: 2px solid #fbbc05;
        }

        .correct-val {
          color: #1b5e20;
        }
        .incorrect-val {
          color: #b71c1c;
        }
        .timeout-val {
          color: #e65100;
        }

        .restart-btn {
          background: #4285f4;
          color: white;
          border: none;
          padding: 15px 40px;
          border-radius: 30px;
          font-weight: 800;
          font-size: 1em;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .restart-btn:hover {
          transform: scale(1.05);
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
        @keyframes pulseZoom {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes pulseZoom1 {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.25);
          }
          100% {
            transform: scale(1);
          }
        }

        @media (max-width: 600px) {
          .answers-grid,
          .stats-row {
            grid-template-columns: 1fr;
          }
          .quiz-card {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}
