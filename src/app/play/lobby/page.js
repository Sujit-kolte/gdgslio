"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function LobbyPage() {
  const router = useRouter();
  const socket = getSocket();

  // State for real-time data
  const [participantCount, setParticipantCount] = useState(1);
  const [myName, setMyName] = useState("");
  const [statusText, setStatusText] = useState("Waiting for Host...");

  useEffect(() => {
    // 1. Get Session Info
    const pId = sessionStorage.getItem("PARTICIPANT_ID");
    const code = sessionStorage.getItem("SESSION_CODE");
    const name = sessionStorage.getItem("PLAYER_NAME");

    if (!pId || !code) {
      router.push("/user");
      return;
    }

    setMyName(name || "Player");

    // 2. Join Session
    socket.emit("join:session", code);

    // 🟢 3. LISTEN FOR GAME START
    socket.on("game:started", () => {
      console.log("🚀 Game Started! Redirecting...");
      setStatusText("Game Starting! 🚀");
      setTimeout(() => {
        router.push("/play");
      }, 500);
    });

    // 🟢 4. FIX: LISTEN FOR REAL COUNT (Backend sends object { count: N })
    socket.on("session:update", (data) => {
      // Check if data has .count property (Backend Update)
      if (data && typeof data.count === "number") {
        setParticipantCount(data.count);
      }
      // Fallback for array (Old Backend version)
      else if (Array.isArray(data)) {
        setParticipantCount(data.length);
      }
    });

    // 🟢 5. NEW: LISTEN FOR FORCE STOP (Kick to Home)
    socket.on("game:force_stop", () => {
      alert("The host has ended the session.");
      sessionStorage.clear(); // Clear data so they can't rejoin easily
      router.push("/");
    });

    // Cleanup
    return () => {
      socket.off("game:started");
      socket.off("session:update");
      socket.off("game:force_stop");
    };
  }, []);

  return (
    <div className="lobby-body">
      <div className="lobby-container">
        {/* HEADER */}
        <header className="lobby-header">
          <div className="logo">
            <span className="logo-icon">🎯</span>
            <span className="logo-text">GDG Quiz</span>
          </div>
          <div className="session-status">
            <span className="status-dot"></span>
            <span className="status-text">{statusText}</span>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="lobby-main">
          <div className="welcome-text">
            <h2>
              Welcome, <span className="highlight">{myName}</span>!
            </h2>
            <p>You are in the lobby.</p>
          </div>

          <div className="count-card">
            <div className="pulse-ring"></div>
            <div className="count-number">{participantCount}</div>
            <div className="count-label">Players Joined</div>
          </div>

          <p className="instruction-text">
            Keep this screen open. The game will start automatically on your
            device.
          </p>
        </main>
      </div>

      <style jsx global>{`
        :root {
          --primary: #2563eb;
          --bg: #f3f4f6;
        }
        .lobby-body {
          margin: 0;
          padding: 0;
          background: var(--bg);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: "Google Sans", sans-serif;
        }

        .lobby-container {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
        }

        /* HEADER */
        .lobby-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
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

        /* MAIN */
        .lobby-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 30px;
        }

        .welcome-text h2 {
          font-size: 2rem;
          color: #333;
          margin: 0;
        }
        .welcome-text p {
          color: #666;
          font-size: 1.1rem;
          margin-top: 5px;
        }
        .highlight {
          color: #2563eb;
        }

        /* COUNT CARD */
        .count-card {
          position: relative;
          width: 200px;
          height: 200px;
          background: white;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          box-shadow: 0 10px 40px rgba(37, 99, 235, 0.2);
          z-index: 2;
        }

        .count-number {
          font-size: 5rem;
          font-weight: 800;
          color: #2563eb;
          line-height: 1;
        }
        .count-label {
          font-size: 1rem;
          color: #6b7280;
          font-weight: 600;
          margin-top: 5px;
        }

        /* PULSE ANIMATION */
        .pulse-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid #2563eb;
          animation: ripple 2s infinite;
          z-index: 1;
        }

        .instruction-text {
          max-width: 400px;
          color: #6b7280;
          line-height: 1.5;
          background: rgba(255, 255, 255, 0.5);
          padding: 15px;
          border-radius: 12px;
        }

        @keyframes pulse {
          50% {
            opacity: 0.5;
          }
        }
        @keyframes ripple {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        /* Mobile */
        @media (max-width: 768px) {
          .count-number {
            font-size: 4rem;
          }
          .count-card {
            width: 160px;
            height: 160px;
          }
        }
      `}</style>
    </div>
  );
}
