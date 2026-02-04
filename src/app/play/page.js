"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import confetti from "canvas-confetti";

// 🟢 CONFIGURATION
// Ensure this matches your live backend URL
const API_URL = "https://gdgslio.onrender.com/api";

export default function GamePlay() {
  const router = useRouter();
  const socket = getSocket();

  // --- STATE ---
  const [view, setView] = useState("LOADING"); // LOADING, LOBBY, QUESTION, RESULT, GAMEOVER
  const [player, setPlayer] = useState({ name: "", score: 0, rank: "--" });

  // Game Data
  const [question, setQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(15);
  const [selectedOption, setSelectedOption] = useState(null);
  const [result, setResult] = useState(null);
  const [winners, setWinners] = useState([]);
  const [history, setHistory] = useState([]);

  // Stats for Game Over
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

    // Default to Lobby until server sends state
    setView("LOBBY");

    // 1. Join & Sync
    socket.emit("join:session", code);
    socket.emit("sync:state", code); // <--- Vital for fixing the blank screen issue

    // 2. Listeners
    socket.on("game:question", handleNewQuestion);
    socket.on("game:result", handleResult);
    socket.on("game:ranks", handleRanks);
    socket.on("game:over", handleGameOver);
    socket.on("sync:idle", () => setView("LOBBY"));

    return () => {
      socket.off("game:question");
      socket.off("game:result");
      socket.off("game:ranks");
      socket.off("game:over");
      socket.off("sync:idle");
      clearInterval(timerRef.current);
    };
  }, []);

  // --- HANDLERS ---
  const handleNewQuestion = (data) => {
    setView("QUESTION");
    setQuestion(data);
    setSelectedOption(null);
    setResult(null);

    // Reset Timer
    const duration = data.time || 15;
    setTotalTime(duration);
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
    // 🛑 STOP TIMER IMMEDIATELY
    clearInterval(timerRef.current);

    setView("RESULT");
    setResult(data);

    // Celebration if correct
    if (data.correctAnswer === selectedOption) {
      triggerConfetti();
    }
  };

  const handleRanks = (rankList) => {
    const pId = sessionStorage.getItem("PARTICIPANT_ID");
    const me = rankList.find((p) => p.id === pId);
    if (me) {
      setPlayer((prev) => ({ ...prev, rank: me.rank, score: me.score }));
    }
  };

  const handleGameOver = async (data) => {
    clearInterval(timerRef.current);
    setView("GAMEOVER");
    if (data.winners) setWinners(data.winners);
    triggerConfetti(true); // Big confetti

    // Fetch History for Stats
    try {
      const pId = sessionStorage.getItem("PARTICIPANT_ID");
      const res = await fetch(`${API_URL}/participants/history/${pId}`);
      const json = await res.json();
      if (json.success) {
        setHistory(json.data);
        const correct = json.data.filter((h) => h.status === "CORRECT").length;
        const incorrect = json.data.filter(
          (h) => h.status === "INCORRECT",
        ).length;
        const timeout =
          json.data.filter((h) => h.status === "TIMEOUT").length || 0;
        setStats({ correct, incorrect, timeout });
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const submitAnswer = async (text) => {
    if (selectedOption) return; // Prevent double submit
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
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    } else {
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    }
  };

  // --- UI CALCS ---
  const radius = 45;
  const circumference = 2 * Math.PI * radius; // ~282.7
  const strokeDashoffset =
    circumference - (timeLeft / totalTime) * circumference;

  let timerClass = "timer-circle-progress";
  if (timeLeft <= 3) timerClass += " danger";
  else if (timeLeft <= 5) timerClass += " warning";

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
          {/* === 1. LOBBY / WAITING FOR NEXT Q === */}
          {view === "LOBBY" && (
            <div className="start-screen">
              <h1>🎯 GDG SKNCOE Quiz</h1>
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
                  <li>Each question has a timer.</li>
                  <li>Faster answers get more points!</li>
                </ul>
              </div>

              <div
                className="timer-circle-container"
                style={{ margin: "0 auto", width: "60px", height: "60px" }}>
                <div className="timer-number" style={{ fontSize: "30px" }}>
                  ⏳
                </div>
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

                  {/* Timer Circle */}
                  <div className="clock-container">
                    <div className="timer-circle-container">
                      <svg
                        className="timer-svg"
                        width="80"
                        height="80"
                        viewBox="0 0 100 100">
                        <defs>
                          <linearGradient
                            id="timerGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%">
                            <stop
                              offset="0%"
                              style={{ stopColor: "#4285F4", stopOpacity: 1 }}
                            />
                            <stop
                              offset="100%"
                              style={{ stopColor: "#4285F4", stopOpacity: 1 }}
                            />
                          </linearGradient>
                          <linearGradient
                            id="warningGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%">
                            <stop
                              offset="0%"
                              style={{ stopColor: "#f39c12", stopOpacity: 1 }}
                            />
                            <stop
                              offset="100%"
                              style={{ stopColor: "#e67e22", stopOpacity: 1 }}
                            />
                          </linearGradient>
                          <linearGradient
                            id="dangerGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%">
                            <stop
                              offset="0%"
                              style={{ stopColor: "#eb3349", stopOpacity: 1 }}
                            />
                            <stop
                              offset="100%"
                              style={{ stopColor: "#f45c43", stopOpacity: 1 }}
                            />
                          </linearGradient>
                        </defs>
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
                {/* Progress Bar */}
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(question.qNum / question.total) * 100}%`,
                    }}></div>
                </div>
              </div>

              {/* Question & Answers */}
              <div className="question-container">
                <div className="question-text">
                  {question.question.questionText}
                </div>
                <div className="answers-grid-kbc">
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
              <h2>
                {selectedOption === result.correctAnswer ? (
                  <span style={{ color: "#34A853" }}>Correct!</span>
                ) : (
                  <span style={{ color: "#EA4335" }}>Wrong!</span>
                )}
              </h2>

              <div className="performance-message">
                Correct Answer: <br />
                <strong style={{ color: "#333" }}>
                  {result.correctAnswer}
                </strong>
              </div>

              <div className="stat-card" style={{ marginTop: "20px" }}>
                <div className="stat-label">Your Score</div>
                <div className="stat-value" style={{ color: "#4285F4" }}>
                  {player.score}
                </div>
              </div>

              <p
                style={{ marginTop: "20px", color: "#888", fontSize: "0.9em" }}>
                Next question coming soon...
              </p>
            </div>
          )}

          {/* === 4. GAMEOVER VIEW === */}
          {view === "GAMEOVER" && (
            <div className="results-container">
              <div className="trophy-container">🏆</div>
              <h2>Quiz Complete!</h2>

              <div className="final-score">#{player.rank}</div>
              <div className="performance-message">
                Final Score: {player.score} pts
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{stats.correct}</div>
                  <div className="stat-label">Correct</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.incorrect}</div>
                  <div className="stat-label">Incorrect</div>
                </div>
              </div>

              <button className="restart-btn" onClick={() => router.push("/")}>
                Exit to Home
              </button>
            </div>
          )}
        </div>
      </div>

      {/* === GLOBAL STYLES === */}
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        .main-body {
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #fbfbfc 0%, #7fbad1 80%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
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
        }
        .container {
          max-width: 800px;
          width: 100%;
        }
        .quiz-card {
          background: white;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          border: 5px solid black;
          padding: 40px;
          position: relative;
          overflow: hidden;
          min-height: 500px;
        }
        .start-screen {
          text-align: center;
          animation: fadeIn 1s ease forwards;
        }
        .start-screen h1 {
          font-size: 2.5em;
          font-weight: 800;
          color: #4285f4;
          margin-bottom: 15px;
        }
        .start-screen-subtitle {
          font-size: 1.3em;
          color: #666;
          margin-bottom: 20px;
        }
        .quiz-rules {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          margin: 20px 0;
          text-align: left;
        }
        .quiz-rules h3 {
          color: #34a853;
          margin-bottom: 15px;
          font-size: 1.3em;
        }
        .quiz-rules ul {
          list-style: none;
          padding: 0;
        }
        .quiz-rules li {
          padding: 8px 0;
          color: #555;
          font-size: 1.05em;
        }
        .quiz-rules li::before {
          content: "✓ ";
          color: #11998e;
          font-weight: bold;
          margin-right: 8px;
        }

        /* Timer */
        .timer-circle-container {
          position: relative;
          width: 80px;
          height: 80px;
        }
        .timer-svg {
          position: absolute;
          top: 0;
          left: 0;
          filter: drop-shadow(0 3px 10px rgba(102, 126, 234, 0.2));
        }
        .timer-circle-bg {
          fill: none;
          stroke: #e0e0e0;
          stroke-width: 4;
        }
        .timer-circle-progress {
          fill: none;
          stroke: url(#timerGradient);
          stroke-width: 4;
          stroke-linecap: round;
          stroke-dasharray: 282.7;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
          transition: stroke-dashoffset 1s linear;
        }
        .timer-circle-progress.warning {
          stroke: url(#warningGradient);
        }
        .timer-circle-progress.danger {
          stroke: url(#dangerGradient);
          animation: timerPulse 0.3s ease infinite;
        }
        @keyframes timerPulse {
          0%,
          100% {
            filter: drop-shadow(0 3px 10px rgba(235, 51, 73, 0.3));
          }
          50% {
            filter: drop-shadow(0 3px 15px rgba(235, 51, 73, 0.6));
          }
        }
        .timer-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }
        .timer-number {
          font-size: 2.2em;
          font-weight: 700;
          color: #34a853;
          line-height: 1;
        }

        /* Progress */
        .progress-container {
          margin-bottom: 30px;
        }
        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
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
          background: linear-gradient(90deg, #52ad69 40%, #159b15 60%);
          border-radius: 10px;
          transition: width 0.5s ease;
        }
        .question-counter {
          background: linear-gradient(135deg, #f0ada7 0%, #ea4335 100%);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
        }
        .score-display-top {
          color: #34a853;
          font-weight: 600;
          padding: 8px 16px;
          background: rgba(102, 126, 234, 0.1);
          border-radius: 20px;
        }

        /* Question */
        .question-container {
          animation: slideIn 0.6s ease forwards;
        }
        .question-text {
          font-size: 1.5em;
          color: #333;
          margin-bottom: 30px;
          font-weight: 600;
          text-align: center;
        }
        .answers-grid-kbc {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .answer-btn {
          padding: 25px 30px;
          border: 3px solid #667eea;
          background: linear-gradient(135deg, #fdfdfd 0%, #fdfdfd 100%);
          border-radius: 15px;
          font-size: 1.15em;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
          color: #333;
          display: flex;
          align-items: center;
          gap: 15px;
          text-align: left;
        }
        .answer-btn::before {
          content: attr(data-option);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 35px;
          height: 35px;
          background: #4285f4;
          color: white;
          border-radius: 50%;
          font-weight: 700;
          font-size: 0.9em;
          flex-shrink: 0;
        }
        .answer-btn:hover {
          border-color: #667eea;
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
        .selected-answer {
          background: #e0f2fe;
          border-color: #2563eb;
          transform: scale(0.98);
        }

        /* Results & GameOver */
        .results-container {
          text-align: center;
          animation: fadeIn 1s ease forwards;
        }
        .results-container h2 {
          font-size: 2.5em;
          color: #4285f4;
          margin-bottom: 20px;
        }
        .final-score {
          font-size: 4em;
          font-weight: 700;
          color: #4285f4;
          margin-bottom: 20px;
        }
        .performance-message {
          font-size: 1.5em;
          color: #666;
          margin-bottom: 30px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          border: 2px solid #e0e0e0;
        }
        .stat-value {
          font-size: 2em;
          font-weight: 700;
          color: #667eea;
          margin-bottom: 5px;
        }
        .stat-label {
          color: #666;
          font-size: 0.9em;
        }
        .trophy-container {
          font-size: 5em;
          margin: 10px 0;
          text-align: center;
          animation: trophyBounce 2s ease-in-out infinite;
        }
        .restart-btn {
          padding: 15px 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 30px;
          font-size: 1.2em;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
        }
        .restart-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
        @keyframes slideIn {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes trophyBounce {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-15px) scale(1.1);
          }
        }
        @media (max-width: 768px) {
          .quiz-card {
            padding: 25px;
            min-height: auto;
          }
          .answers-grid-kbc {
            grid-template-columns: 1fr;
          }
          .timer-circle-container {
            width: 60px;
            height: 60px;
          }
          .timer-number {
            font-size: 1.6em;
          }
          .question-text {
            font-size: 1.2em;
          }
          .answer-btn {
            padding: 15px;
            font-size: 1em;
          }
        }
      `}</style>
    </div>
  );
}
