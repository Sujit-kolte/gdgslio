"use client";
import { useEffect, useState, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { useRouter } from "next/navigation";

// 🟢 CONFIGURATION
const API_URL = "https://gdgslio.onrender.com/api";

export default function Dashboard() {
  const router = useRouter();
  const socket = getSocket();

  // --- STATE ---
  const [passcode, setPasscode] = useState("");
  const [sessions, setSessions] = useState([]);
  const [questions, setQuestions] = useState([]);

  // 🟢 UPDATED: stats now includes 'users'
  const [stats, setStats] = useState({ sessions: 0, questions: 0, users: 0 });
  const [liveUsers, setLiveUsers] = useState(0);

  const [currentSessionCode, setCurrentSessionCode] = useState(null);
  const [managerView, setManagerView] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newCode, setNewCode] = useState("");
  const [qText, setQText] = useState("");
  const [options, setOptions] = useState([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);

  const [previewQ, setPreviewQ] = useState(null);
  const [updateQ, setUpdateQ] = useState(null);
  const [updateText, setUpdateText] = useState("");
  const [theme, setTheme] = useState("light");

  // --- INITIALIZATION ---
  useEffect(() => {
    const p = sessionStorage.getItem("ADMIN_PASSCODE");
    if (!p) return router.push("/admin");
    setPasscode(p);

    loadSessions(p);
    loadGlobalStats(p); // 🟢 Fetch the user count

    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    socket.on("session:update", (data) => {
      setLiveUsers(data.count > 0 ? data.count : 0);
    });

    return () => {
      socket.off("session:update");
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  // 🟢 NEW API CALL: Fetch Total Users
  const loadGlobalStats = async (token = passcode) => {
    try {
      const res = await fetch(`${API_URL}/admin/stats`, {
        headers: { "admin-passcode": token },
      });
      const data = await res.json();
      if (data.success) {
        setStats((prev) => ({ ...prev, users: data.userCount }));
      }
    } catch (e) {
      console.error("Stats Load Error", e);
    }
  };

  const loadSessions = async (token = passcode) => {
    try {
      const res = await fetch(`${API_URL}/sessions`);
      const data = await res.json();
      const sessionList = data.data || [];
      setSessions(sessionList);
      setStats((prev) => ({ ...prev, sessions: sessionList.length }));
    } catch (e) {
      console.error("Load Error", e);
    }
  };

  const createSession = async () => {
    if (!newTitle || !newCode) return alert("Please fill in both fields.");
    try {
      await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "admin-passcode": passcode,
        },
        body: JSON.stringify({
          title: newTitle,
          sessionCode: newCode.toUpperCase(),
        }),
      });
      setNewTitle("");
      setNewCode("");
      loadSessions();
    } catch (e) {
      console.error(e);
    }
  };

  const startSession = async (id, code) => {
    if (!confirm(`Start Session ${code}? Players can join now.`)) return;
    window.open(`/leaderboard?code=${code}`, "_blank");
    try {
      const res = await fetch(`${API_URL}/sessions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "admin-passcode": passcode,
        },
        body: JSON.stringify({ sessionCode: code }),
      });
      const data = await res.json();
      if (!data.success) alert("Failed to start: " + data.message);
      loadSessions();
    } catch (e) {
      alert("Error starting session");
    }
  };

  const stopSession = async (id) => {
    if (!confirm("Stop Session?")) return;
    await fetch(`${API_URL}/sessions/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "admin-passcode": passcode,
      },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    loadSessions();
  };

  const deleteSession = async (code) => {
    if (!confirm("PERMANENTLY DELETE Session? This cannot be undone.")) return;
    await fetch(`${API_URL}/sessions/code/${code}/permanent`, {
      method: "DELETE",
      headers: { "admin-passcode": passcode },
    });
    if (currentSessionCode === code) closeManager();
    loadSessions();
    loadGlobalStats(); // Refresh stats
  };

  const resetSession = async (id) => {
    if (!confirm("Reset Session Data? This deletes all user scores.")) return;
    await fetch(`${API_URL}/sessions/${id}/data`, {
      method: "DELETE",
      headers: { "admin-passcode": passcode },
    });
    alert("Session data cleared.");
    loadSessions();
    loadGlobalStats(); // Refresh stats
  };

  // --- API ACTIONS: QUESTIONS ---
  const openQManager = (code) => {
    setCurrentSessionCode(code);
    setManagerView(true);
    fetchQuestions(code);
    setQText("");
    setOptions([
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ]);
    socket.emit("join:session", code); // Sync live count
  };

  const closeManager = () => {
    setManagerView(false);
    setCurrentSessionCode(null);
    setLiveUsers(0);
  };

  const fetchQuestions = async (code) => {
    try {
      const res = await fetch(`${API_URL}/questions/session/${code}`);
      const data = await res.json();
      const qList = data.data || [];
      setQuestions(qList);
      setStats((prev) => ({ ...prev, questions: qList.length }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleOptionChange = (index, field, value) => {
    const newOpts = [...options];
    if (field === "isCorrect") {
      newOpts.forEach((o) => (o.isCorrect = false));
      newOpts[index].isCorrect = true;
    } else {
      newOpts[index][field] = value;
    }
    setOptions(newOpts);
  };

  const saveQuestion = async () => {
    if (
      !qText ||
      options.some((o) => !o.text) ||
      !options.some((o) => o.isCorrect)
    )
      return alert("Invalid Question");
    await fetch(`${API_URL}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "admin-passcode": passcode,
      },
      body: JSON.stringify({
        sessionId: currentSessionCode,
        questionText: qText,
        options,
        marks: 10,
      }),
    });
    setQText("");
    setOptions([
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ]);
    fetchQuestions(currentSessionCode);
  };

  const deleteQuestion = async (id) => {
    if (!confirm("Delete this question?")) return;
    await fetch(`${API_URL}/questions/${id}`, {
      method: "DELETE",
      headers: { "admin-passcode": passcode },
    });
    fetchQuestions(currentSessionCode);
  };

  const moveQuestion = async (id, dir) => {
    await fetch(`${API_URL}/questions/reorder/all`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "admin-passcode": passcode,
      },
      body: JSON.stringify({ questionId: id, direction: dir }),
    });
    fetchQuestions(currentSessionCode);
  };

  const confirmUpdate = async () => {
    if (!updateText || !updateQ) return;
    await fetch(`${API_URL}/questions/${updateQ._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "admin-passcode": passcode,
      },
      body: JSON.stringify({
        sessionId: currentSessionCode,
        questionText: updateText,
        options: updateQ.options,
        marks: 10,
      }),
    });
    setUpdateQ(null);
    fetchQuestions(currentSessionCode);
  };

  return (
    <div className="layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">🛠</div>
          <span>Admin Panel</span>
        </div>
        <div
          className="card"
          style={{
            padding: "20px",
            background: "var(--bg-light)",
            boxShadow: "none",
          }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "16px" }}>
            Create Session
          </h3>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title"
          />
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="Code"
          />
          <button
            className="btn-blue"
            style={{ width: "100%" }}
            onClick={createSession}>
            + Add Session
          </button>
        </div>
        <h3
          style={{
            fontSize: "0.938rem",
            color: "var(--text-secondary)",
            margin: "24px 0 16px 12px",
            fontWeight: 500,
          }}>
          Your Sessions
        </h3>
        <div>
          {sessions.map((s) => (
            <div
              key={s._id}
              className={`session-item ${s.status === "ACTIVE" ? "active-session" : ""}`}>
              <div className="session-info">
                <div className="session-title">{s.title}</div>
                <div className="session-meta">
                  <span>{s.sessionCode}</span>
                  <span>•</span>
                  <span className={`badge ${s.status}`}>{s.status}</span>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}>
                <button
                  className="btn-blue"
                  onClick={() => openQManager(s.sessionCode)}
                  style={{ gridColumn: "span 2" }}>
                  Manage Questions
                </button>
                {s.status === "ACTIVE" ? (
                  <button
                    className="btn-yellow"
                    onClick={() => stopSession(s._id)}>
                    Stop
                  </button>
                ) : (
                  <button
                    className="btn-green"
                    onClick={() => startSession(s._id, s.sessionCode)}>
                    Start
                  </button>
                )}
                <button
                  className="btn-purple"
                  onClick={() => resetSession(s._id)}
                  title="Reset">
                  ♻️
                </button>
                <button
                  className="btn-red"
                  onClick={() => deleteSession(s.sessionCode)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <div className="top-navbar">
          <div className="page-title">Dashboard Overview</div>
          <div className="navbar-actions">
            <button
              className="leaderboard-link"
              onClick={() =>
                currentSessionCode
                  ? window.open(
                      `/leaderboard?code=${currentSessionCode}`,
                      "_blank",
                    )
                  : alert("Select a session")
              }>
              <span className="leaderboard-icon">🏆</span>
              <span>Leaderboard</span>
            </button>
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>

        {/* 🟢 STATS GRID - REPLACED Total Sessions with Total Participants */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            {/* Displaying Real Database User Count */}
            <div className="stat-value">{stats.users}</div>
            <div className="stat-label">Total Participants</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✓</div>
            <div className="stat-value">{stats.questions}</div>
            <div className="stat-label">Total Questions</div>
          </div>
        </div>

        {!managerView ? (
          <div className="card">
            <div className="placeholder-content">
              <div className="placeholder-icon">📋</div>
              <div className="placeholder-text">
                Select a session to manage questions
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="section-header">
              <h2 style={{ margin: 0 }}>
                Managing:{" "}
                <span className="code-badge">{currentSessionCode}</span>
              </h2>
              <div className="live-badge">🔴 {liveUsers} Live</div>
              <button
                className="btn-grey"
                onClick={closeManager}
                style={{ marginLeft: "auto" }}>
                Close
              </button>
            </div>
            {/* Add Question Form */}
            <div className="card">
              <h3>Add New Question</h3>
              <input
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Question..."
              />
              <div>
                {options.map((opt, idx) => (
                  <div key={idx} className="option-row">
                    <input
                      type="radio"
                      checked={opt.isCorrect}
                      onChange={() =>
                        handleOptionChange(idx, "isCorrect", true)
                      }
                    />
                    <input
                      className="opt-text"
                      value={opt.text}
                      onChange={(e) =>
                        handleOptionChange(idx, "text", e.target.value)
                      }
                      placeholder="Option..."
                    />
                    {options.length > 2 && (
                      <button
                        className="btn-red"
                        onClick={() =>
                          setOptions(options.filter((_, i) => i !== idx))
                        }>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="btn-grey"
                style={{ marginTop: "10px" }}
                onClick={() =>
                  setOptions([...options, { text: "", isCorrect: false }])
                }>
                + Add Option
              </button>
              <div style={{ marginTop: "24px" }}>
                <button className="btn-blue" onClick={saveQuestion}>
                  Save Question
                </button>
              </div>
            </div>
            {/* Question List */}
            <h3 style={{ margin: "32px 0 16px 0" }}>Existing Questions</h3>
            <div>
              {questions.map((q, index) => (
                <div key={q._id} className="question-box">
                  <div className="q-header">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flex: 1,
                      }}>
                      <span className="question-number">{index + 1}</span>
                      <strong>{q.questionText}</strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                      }}>
                      <div className="reorder-controls">
                        <button
                          className="reorder-btn"
                          disabled={index === 0}
                          onClick={() => moveQuestion(q._id, "up")}>
                          ▲
                        </button>
                        <button
                          className="reorder-btn"
                          disabled={index === questions.length - 1}
                          onClick={() => moveQuestion(q._id, "down")}>
                          ▼
                        </button>
                      </div>
                      <div className="q-actions">
                        <button
                          className="btn-outline"
                          onClick={() => setPreviewQ(q)}>
                          Preview
                        </button>
                        <button
                          className="btn-blue"
                          onClick={() => {
                            setUpdateQ(q);
                            setUpdateText(q.questionText);
                          }}>
                          Update
                        </button>
                        <button
                          className="btn-red"
                          onClick={() => deleteQuestion(q._id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {previewQ && (
        <div
          className="modal show"
          onClick={(e) =>
            e.target.className.includes("modal") && setPreviewQ(null)
          }>
          <div className="modal-content">
            <span className="close" onClick={() => setPreviewQ(null)}>
              ✕
            </span>
            <h2>Preview</h2>
            <div
              style={{
                padding: "20px",
                background: "var(--bg-light)",
                borderRadius: "12px",
              }}>
              <h3>{previewQ.questionText}</h3>
              {previewQ.options.map((o, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px",
                    marginTop: "8px",
                    borderRadius: "8px",
                    background: o.isCorrect ? "#e6f4ea" : "white",
                    border: o.isCorrect
                      ? "1px solid #34a853"
                      : "1px solid #dadce0",
                  }}>
                  {o.text} {o.isCorrect && "✅"}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {updateQ && (
        <div
          className="modal show"
          onClick={(e) =>
            e.target.className.includes("modal") && setUpdateQ(null)
          }>
          <div className="modal-content">
            <span className="close" onClick={() => setUpdateQ(null)}>
              ✕
            </span>
            <h2>Update</h2>
            <input
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
            />
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}>
              <button className="btn-grey" onClick={() => setUpdateQ(null)}>
                Cancel
              </button>
              <button className="btn-blue" onClick={confirmUpdate}>
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@300;400;500;700&display=swap");
        :root {
          --google-blue: #4285f4;
          --google-red: #ea4335;
          --google-yellow: #fbbc05;
          --google-green: #34a853;
          --white: #ffffff;
          --bg-light: #f8f9fa;
          --text-primary: #202124;
          --text-secondary: #5f6368;
          --border-light: #dadce0;
          --shadow-sm: 0 1px 2px 0 rgba(60, 64, 67, 0.3);
          --shadow-lg: 0 8px 24px 4px rgba(60, 64, 67, 0.15);
        }
        [data-theme="dark"] {
          --white: #1f1f1f;
          --bg-light: #121212;
          --text-primary: #e8eaed;
          --text-secondary: #9aa0a6;
          --border-light: #3c4043;
        }
        body {
          margin: 0;
          font-family: "Roboto", sans-serif;
          background: var(--bg-light);
          color: var(--text-primary);
        }
        .layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          min-height: 100vh;
        }
        .sidebar {
          background: var(--white);
          padding: 24px 16px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          border-right: 1px solid var(--border-light);
        }
        .logo {
          font-family: "Google Sans", sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 32px;
          padding: 0 12px;
        }
        .logo-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(
            135deg,
            var(--google-blue),
            var(--google-green)
          );
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .main-content {
          padding: 32px 40px;
        }
        .top-navbar {
          background: var(--white);
          padding: 20px 32px;
          border-radius: 16px;
          margin-bottom: 32px;
          box-shadow: var(--shadow-sm);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .page-title {
          font-family: "Google Sans", sans-serif;
          font-size: 1.75rem;
          font-weight: 700;
        }
        .navbar-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .leaderboard-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: linear-gradient(
            135deg,
            var(--google-blue),
            var(--google-green)
          );
          color: white;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .theme-toggle {
          background: var(--bg-light);
          border: 2px solid var(--border-light);
          cursor: pointer;
          padding: 10px;
          border-radius: 12px;
          font-size: 1.2rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: var(--white);
          padding: 24px;
          border-radius: 16px;
          box-shadow: var(--shadow-sm);
          position: relative;
          overflow: hidden;
        }
        .stat-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: var(--google-blue);
        }
        .stat-card:nth-child(2)::before {
          background: var(--google-green);
        }
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          font-size: 24px;
          background: rgba(66, 133, 244, 0.1);
          color: var(--google-blue);
        }
        .stat-value {
          font-family: "Google Sans", sans-serif;
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        .card {
          background: var(--white);
          padding: 28px;
          border-radius: 16px;
          margin-bottom: 24px;
          box-shadow: var(--shadow-sm);
        }
        input {
          width: 100%;
          padding: 14px 16px;
          margin-bottom: 16px;
          background: var(--white);
          border: 2px solid var(--border-light);
          border-radius: 12px;
          color: var(--text-primary);
          box-sizing: border-box;
        }
        button {
          padding: 12px 24px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }
        .btn-blue {
          background: var(--google-blue);
          color: white;
        }
        .btn-green {
          background: var(--google-green);
          color: white;
        }
        .btn-red {
          background: var(--google-red);
          color: white;
        }
        .btn-yellow {
          background: var(--google-yellow);
          color: var(--text-primary);
        }
        .btn-purple {
          background: #7c3aed;
          color: white;
        }
        .btn-grey {
          background: #e8eaed;
          color: var(--text-primary);
        }
        .btn-outline {
          background: transparent;
          color: var(--google-blue);
          border: 2px solid var(--google-blue);
        }
        .session-item {
          padding: 20px;
          background: var(--white);
          border: 2px solid var(--border-light);
          border-radius: 12px;
          margin-bottom: 12px;
        }
        .active-session {
          border-color: var(--google-green);
          background: rgba(52, 168, 83, 0.03);
        }
        .session-title {
          font-weight: 700;
          font-size: 1.06rem;
          margin-bottom: 6px;
        }
        .session-meta {
          font-size: 0.875rem;
          color: var(--text-secondary);
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 16px;
        }
        .badge {
          padding: 4px 12px;
          font-size: 0.75rem;
          border-radius: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .WAITING {
          background: rgba(251, 188, 5, 0.15);
          color: #e37400;
        }
        .ACTIVE {
          background: rgba(52, 168, 83, 0.15);
          color: #188038;
        }
        .COMPLETED {
          background: rgba(0, 0, 0, 0.05);
          color: var(--text-secondary);
        }
        .section-header {
          display: flex;
          alignitems: center;
          padding: 20px 28px;
          background: linear-gradient(
            135deg,
            rgba(66, 133, 244, 0.05),
            rgba(52, 168, 83, 0.05)
          );
          border-radius: 12px;
          margin-bottom: 20px;
          border-left: 4px solid var(--google-blue);
        }
        .code-badge {
          color: var(--google-blue);
          font-weight: 700;
          font-size: 1.1rem;
        }
        .live-badge {
          margin-left: 20px;
          padding: 6px 12px;
          background: #ffebee;
          color: #d32f2f;
          border-radius: 20px;
          font-weight: 700;
          font-size: 0.85rem;
        }
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
          100% {
            opacity: 1;
          }
        }
        .question-box {
          border: 2px solid var(--border-light);
          padding: 24px;
          margin-bottom: 16px;
          background: var(--white);
          border-radius: 12px;
        }
        .question-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 32px;
          background: var(--google-blue);
          color: white;
          border-radius: 8px;
          font-weight: 700;
          margin-right: 12px;
        }
        .reorder-controls {
          display: flex;
          flexdirection: column;
          gap: 4px;
        }
        .reorder-btn {
          padding: 4px 8px;
          font-size: 12px;
          min-width: 32px;
          background: var(--border-light);
          color: var(--text-primary);
          border-radius: 6px;
        }
        .option-row {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
          align-items: center;
        }
        .option-row input[type="radio"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: var(--google-blue);
        }
        .placeholder-content {
          text-align: center;
          padding: 80px 20px;
        }
        .placeholder-icon {
          font-size: 64px;
          margin-bottom: 24px;
          opacity: 0.3;
        }
        .modal {
          display: none;
          position: fixed;
          z-index: 1000;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease;
        }
        .modal.show {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-content {
          background: var(--white);
          padding: 32px;
          width: 90%;
          max-width: 600px;
          border-radius: 16px;
          box-shadow: var(--shadow-lg);
          position: relative;
          animation: slideUp 0.3s ease;
        }
        .close {
          position: absolute;
          right: 20px;
          top: 20px;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-secondary);
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .close:hover {
          background: var(--bg-light);
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(50px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
