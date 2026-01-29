"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

// --- CONFIGURATION ---
const CONFIG = {
  terminalMessages: [
    "$ Initializing session lobby...",
    "$ Loading participant data...",
    "$ Connecting to server...",
    "$ Server connection established ✓",
    "$ Preparing interactive environment...",
    "$ All systems ready ✓",
    "$ Welcome to GDG Quiz Session!",
  ],
  typingSpeed: 30,
  messageDelay: 400,
};

const avatarEmojis = [
  "👨",
  "👩",
  "🧑",
  "👴",
  "👵",
  "👦",
  "👧",
  "🧔",
  "👱",
  "👨‍💼",
  "👩‍💼",
  "👨‍🎓",
  "👩‍🎓",
  "👨‍🔬",
  "👩‍🔬",
  "👨‍💻",
  "👩‍💻",
  "👨‍🎨",
  "👩‍🎨",
  "🧑‍🚀",
];

export default function LobbyPage() {
  const router = useRouter();
  const socket = getSocket();

  const [view, setView] = useState("TERMINAL"); // TERMINAL -> WELCOME -> LOBBY
  const [terminalLines, setTerminalLines] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [myPlayer, setMyPlayer] = useState({ name: "Player" });
  const [currentTime, setCurrentTime] = useState("");

  const terminalRef = useRef(null);

  // --- 1. SETUP & SOCKETS ---
  useEffect(() => {
    // Check if user is logged in
    const pId = sessionStorage.getItem("PARTICIPANT_ID");
    const code = sessionStorage.getItem("SESSION_CODE");
    const name = sessionStorage.getItem("PLAYER_NAME");

    if (!pId || !code) {
      router.push("/user");
      return;
    }

    setMyPlayer({ name });

    // Join the socket room
    socket.emit("join:session", code);

    // 🟢 LISTEN FOR GAME START
    socket.on("game:started", () => {
      console.log("Game started! Moving to play area...");
      router.push("/play");
    });

    // Clock
    const timeInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }, 60000);
    setCurrentTime(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );

    // Simulate "Lobby Activity" (Fake users joining for visual effect)
    const fakeJoinInterval = setInterval(() => {
      if (Math.random() > 0.6) addRandomParticipant();
    }, 4000);

    return () => {
      socket.off("game:started");
      clearInterval(timeInterval);
      clearInterval(fakeJoinInterval);
    };
  }, []);

  // --- 2. TERMINAL ANIMATION ---
  useEffect(() => {
    if (view !== "TERMINAL") return;

    let msgIndex = 0;
    let charIndex = 0;
    let currentLineText = "";

    const typeNextChar = () => {
      if (msgIndex >= CONFIG.terminalMessages.length) {
        setTimeout(() => setView("WELCOME"), 800);
        return;
      }

      const message = CONFIG.terminalMessages[msgIndex];

      if (charIndex < message.length) {
        currentLineText += message[charIndex];
        setTerminalLines((prev) => {
          const newLines = [...prev];
          if (newLines.length === 0 || charIndex === 0)
            newLines.push(currentLineText);
          else newLines[newLines.length - 1] = currentLineText;
          return newLines;
        });
        charIndex++;
        setTimeout(typeNextChar, CONFIG.typingSpeed);
      } else {
        msgIndex++;
        charIndex = 0;
        currentLineText = "";
        setTimeout(typeNextChar, CONFIG.messageDelay);
      }
    };

    typeNextChar();
  }, [view]);

  // --- 3. WELCOME TRANSITION ---
  useEffect(() => {
    if (view === "WELCOME") {
      const timer = setTimeout(() => {
        setView("LOBBY");
        // Add self to list
        setParticipants([
          {
            id: "me",
            name: sessionStorage.getItem("PLAYER_NAME") || "Me",
            emoji: "😎",
          },
        ]);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [view]);

  const addRandomParticipant = () => {
    setParticipants((prev) => {
      if (prev.length > 20) return prev;
      return [
        ...prev,
        {
          id: Date.now(),
          name: "Guest " + Math.floor(Math.random() * 99),
          emoji: avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)],
        },
      ];
    });
  };

  // --- RENDER ---
  return (
    <div className="lobby-body">
      {/* 1. TERMINAL */}
      {view === "TERMINAL" && (
        <section className="terminal-section active">
          <div className="terminal-container">
            <div className="terminal-header">
              <div className="terminal-buttons">
                <span className="btn-close"></span>
                <span className="btn-minimize"></span>
                <span className="btn-maximize"></span>
              </div>
              <div className="terminal-title">session_lobby.sh</div>
            </div>
            <div className="terminal-body" ref={terminalRef}>
              {terminalLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              <span className="cursor">|</span>
            </div>
          </div>
        </section>
      )}

      {/* 2. WELCOME */}
      <section
        className={`welcome-section ${view === "WELCOME" ? "active" : ""}`}>
        <div className="welcome-container">
          <div className="welcome-icon">👋</div>
          <h1 className="welcome-title">Welcome, {myPlayer.name}!</h1>
          <p className="welcome-subtitle">
            Get ready for an interactive experience!
          </p>
          <div className="welcome-loader">
            <div className="loader-bar"></div>
          </div>
        </div>
      </section>

      {/* 3. LOBBY */}
      <section className={`lobby-section ${view === "LOBBY" ? "active" : ""}`}>
        <div className="lobby-container">
          <header className="lobby-header">
            <div className="logo">
              <span className="logo-icon">🎯</span>
              <span className="logo-text">GDG Quiz</span>
            </div>
            <div className="session-status">
              <span className="status-dot"></span>
              <span className="status-text">Waiting for Host</span>
            </div>
          </header>

          <div className="lobby-main">
            <div className="start-section">
              <div className="motivation-card">
                <h2 className="motivation-title">🚀 You are In!</h2>
                <p className="motivation-text">
                  Sit tight! The host will start the quiz shortly.
                </p>
                <div className="start-button disabled">
                  <span className="button-text">Waiting...</span>
                  <span className="button-icon">⏳</span>
                </div>
              </div>
            </div>

            <div className="participants-section">
              <div className="participants-header">
                <h3 className="participants-title">Participants</h3>
                <div className="participants-count">
                  <span className="count-number">{participants.length}</span>
                  <span className="count-label">online</span>
                </div>
              </div>
              <div className="participants-display">
                {participants.map((p, i) => (
                  <div
                    key={p.id}
                    className="participant-avatar"
                    data-name={p.name}
                    style={{ animationDelay: `${i * 0.1}s` }}>
                    {p.emoji}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <footer className="lobby-footer">
            <p>Google Developers Group • {currentTime}</p>
          </footer>
        </div>
      </section>

      {/* STYLES */}
      <style jsx global>{`
        :root {
          --primary: #2563eb;
          --bg: #f3f4f6;
          --term-bg: #1e1e1e;
        }
        .lobby-body {
          margin: 0;
          padding: 0;
          background: var(--bg);
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          position: fixed;
          top: 0;
          left: 0;
          font-family: sans-serif;
        }

        section {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: none;
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        section.active {
          display: flex;
          opacity: 1;
          z-index: 10;
        }

        /* Terminal */
        .terminal-section {
          background: #000;
          justify-content: center;
          align-items: center;
        }
        .terminal-container {
          width: 90%;
          max-width: 600px;
          background: var(--term-bg);
          border-radius: 8px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }
        .terminal-header {
          background: #2d2d2d;
          padding: 10px 15px;
          display: flex;
          align-items: center;
          position: relative;
        }
        .terminal-buttons {
          display: flex;
          gap: 8px;
        }
        .terminal-buttons span {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }
        .btn-close {
          background: #ff5f56;
        }
        .btn-minimize {
          background: #ffbd2e;
        }
        .btn-maximize {
          background: #27c93f;
        }
        .terminal-body {
          padding: 20px;
          color: #fff;
          font-family: monospace;
          min-height: 250px;
          line-height: 1.5;
        }
        .cursor {
          display: inline-block;
          width: 8px;
          background: #fff;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          50% {
            opacity: 0;
          }
        }

        /* Welcome */
        .welcome-section {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          justify-content: center;
          align-items: center;
          color: white;
          text-align: center;
        }
        .welcome-icon {
          font-size: 64px;
          margin-bottom: 20px;
          animation: wave 2s infinite;
        }
        .welcome-loader {
          width: 200px;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          margin: 30px auto;
          overflow: hidden;
        }
        .loader-bar {
          height: 100%;
          background: white;
          width: 0%;
          animation: loading 2.5s linear forwards;
        }
        @keyframes loading {
          to {
            width: 100%;
          }
        }
        @keyframes wave {
          0%,
          100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(20deg);
          }
          75% {
            transform: rotate(-20deg);
          }
        }

        /* Lobby */
        .lobby-section {
          background: #f3f4f6;
          padding: 20px;
          overflow-y: auto;
        }
        .lobby-container {
          max-width: 1000px;
          margin: 0 auto;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .lobby-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .logo {
          display: flex;
          gap: 10px;
          font-size: 24px;
          font-weight: 800;
          color: #1f2937;
        }
        .session-status {
          background: #dbeafe;
          color: #1e40af;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          background: #2563eb;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .lobby-main {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }
        @media (max-width: 768px) {
          .lobby-main {
            grid-template-columns: 1fr;
          }
        }

        .motivation-card,
        .participants-section {
          background: white;
          padding: 30px;
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
          text-align: center;
        }
        .participants-display {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
          gap: 15px;
          max-height: 300px;
          overflow-y: auto;
          margin-top: 20px;
        }
        .participant-avatar {
          width: 50px;
          height: 50px;
          background: #f9fafb;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 24px;
          animation: popIn 0.3s;
        }
        .lobby-footer {
          text-align: center;
          padding: 20px;
          color: #9ca3af;
          font-size: 13px;
          margin-top: auto;
        }

        @keyframes pulse {
          50% {
            opacity: 0.5;
          }
        }
        @keyframes popIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
