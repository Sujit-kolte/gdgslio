"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const socket = getSocket();
  const code = searchParams.get("code");

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- 1. SOCKET & DATA LOGIC ---
  useEffect(() => {
    if (!code) return;

    // Join the session room
    socket.emit("join:session", code);

    // Listen for live rank updates
    socket.on("game:ranks", (data) => {
      const sorted = data.sort((a, b) => b.score - a.score);
      setLeaderboard(sorted);
      setLoading(false);
    });

    // Listen for game over
    socket.on("game:over", () => {
      launchConfetti();
    });

    return () => {
      socket.off("game:ranks");
      socket.off("game:over");
    };
  }, [code, socket]);

  // --- 2. CONFETTI EFFECT ---
  const launchConfetti = () => {
    const colors = ["#ff4d4d", "#4d79ff", "#ffd24d", "#4dff88", "#c44dff"];
    const board = document.getElementById("board");
    if (!board) return;

    for (let i = 0; i < 50; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.left = Math.random() * 100 + "%";
      c.style.backgroundColor =
        colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDelay = Math.random() * 0.4 + "s";
      board.appendChild(c);
      setTimeout(() => c.remove(), 3000);
    }
  };

  return (
    <div className="leaderboard-body">
      <div className="leaderboard-card" id="board">
        <div className="trophy">
          <span>🏆</span>
        </div>
        <h2>{loading ? `Waiting for Players...` : "Live Leaderboard"}</h2>

        {code && (
          <div
            style={{
              textAlign: "center",
              marginBottom: "15px",
              color: "#4f6bed",
              fontSize: "14px",
              fontWeight: "600",
            }}>
            Session: {code}
          </div>
        )}

        {/* LIST */}
        <div className="list">
          {leaderboard.length === 0 && !loading ? (
            <div
              style={{ textAlign: "center", padding: "20px", color: "#999" }}>
              No players yet
            </div>
          ) : (
            leaderboard.map((user, index) => (
              <div
                key={user.id || index}
                className="card"
                style={{ animationDelay: `${Math.min(index * 0.1, 1.0)}s` }}>
                <div className="left">
                  <div className="rank">#{index + 1}</div>
                  <div
                    className="avatar"
                    style={{
                      backgroundImage: `url('https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}')`,
                      backgroundColor: "#fff",
                    }}></div>
                  <div className="name">{user.name}</div>
                </div>
                <div className="score">{user.score} pts</div>
              </div>
            ))
          )}
        </div>
        <div className="footer">🎉 Congratulations to all participants!</div>
      </div>

      <style jsx global>{`
        .leaderboard-body {
          min-height: 100vh;
          width: 100%;
          background: linear-gradient(135deg, #f6f9ff, #e9f0ff);
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: "Segoe UI", Tahoma, sans-serif;
        }
        .leaderboard-card {
          width: 680px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border: 3px solid #000;
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 10px 0 rgba(0, 0, 0, 0.15);
          position: relative;
          overflow: hidden;
        }
        .trophy {
          display: flex;
          justify-content: center;
          margin-bottom: 10px;
        }
        .trophy span {
          font-size: 56px;
          display: block;
        }
        h2 {
          text-align: center;
          color: #4f6bed;
          margin-bottom: 18px;
          margin-top: 0;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 100px;
          overflow-y: auto;
          padding-right: 5px;
          scrollbar-width: thin;
        }
        .card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f7f8ff;
          border-radius: 12px;
          padding: 10px 14px;
          animation: slideUp 0.6s ease forwards;
        }
        .card:nth-child(1) {
          background: #fff3c4;
          border: 1px solid #ffd700;
        }
        .card:nth-child(2) {
          background: #f1f1f1;
          border: 1px solid #c0c0c0;
        }
        .card:nth-child(3) {
          background: #ffe1cc;
          border: 1px solid #cd7f32;
        }

        .left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .rank {
          font-weight: 700;
          color: #333;
          width: 28px;
        }
        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background-size: cover;
          border: 2px solid #000;
        }
        .name {
          font-size: 15px;
          font-weight: 600;
          color: #000;
        }
        .score {
          font-size: 14px;
          font-weight: 700;
          color: #000;
        }
        .footer {
          margin-top: 22px;
          text-align: center;
          font-size: 15px;
          font-weight: 700;
          color: #333;
        }
        .confetti {
          position: absolute;
          top: -10px;
          width: 8px;
          height: 14px;
          opacity: 0.9;
          animation: fall 3s ease-out forwards;
          z-index: 5;
        }
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          100% {
            transform: translateY(520px) rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }>
      <LeaderboardContent />
    </Suspense>
  );
}
