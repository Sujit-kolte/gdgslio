"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import Footer from "@/components/Footer";

export default function Home() {
  const router = useRouter();
  const [theme, setTheme] = useState("light");
  const [quizStep, setQuizStep] = useState(0);

  // --- 1. THEME LOGIC ---
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  // --- 2. ANIMATION LOOPS ---
  useEffect(() => {
    const runCycle = () => {
      setQuizStep(0);
      setTimeout(() => setQuizStep(1), 800);
      setTimeout(() => setQuizStep(2), 1800);
      setTimeout(() => setQuizStep(3), 2300);
      setTimeout(() => setQuizStep(4), 2800);
    };
    runCycle();
    const interval = setInterval(runCycle, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- 3. TIMELINE OBSERVER ---
  const timelineRef = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting)
            entry.target.classList.add("animate-timeline");
        });
      },
      { threshold: 0.2 },
    );
    if (timelineRef.current) observer.observe(timelineRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300 page-container">
      {/* === NAVBAR === */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md shadow-sm z-50 transition-all duration-300 dark:bg-gray-900/80 dark:border-b dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          {/* ✅ UPDATED LOGO SECTION */}
          <div className="flex items-center gap-3 logo">
            <Link href="/">
              <Image
                src="/assests/logo.png"
                alt="GDG Logo"
                width={0} // 👈 Allows CSS to control size
                height={0} // 👈 Allows CSS to control size
                sizes="100vw"
                className="w-auto" // Tailwind fallback
                priority
              />
            </Link>
            <span className="font-bold text-xl text-gray-800 tracking-tight dark:text-white">
              GDG SKNCOE
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="hidden md:block text-sm font-semibold text-gray-600 hover:text-blue-600 dark:text-gray-300">
              Admin Portal
            </Link>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all">
              {theme === "light" ? (
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* === HERO SECTION === */}
      <main className="flex-1">
        <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left z-10">
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight dark:text-white">
              <span className="text-blue-600 inline-block hover:-translate-y-1 transition-transform">
                Play.
              </span>{" "}
              <span className="text-green-600 inline-block hover:-translate-y-1 transition-transform">
                Learn.
              </span>{" "}
              <span className="text-red-500 inline-block hover:-translate-y-1 transition-transform">
                Compete.
              </span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed dark:text-gray-300">
              Participate in <strong>quizzes</strong> and exciting
              mini-competitions.
              <br className="hidden md:block" />
              Test your knowledge, engage with peers, and make the experience
              unforgettable.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={() => router.push("/user")}
                className="px-8 py-4 bg-blue-600 text-white rounded-full font-bold text-lg hover:bg-blue-700 hover:shadow-lg transition-all transform hover:-translate-y-1">
                Join Event Now
              </button>
              <button className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-full font-bold text-lg hover:bg-gray-50 transition-all dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800">
                View Members
              </button>
            </div>
          </div>

          <div className="relative flex justify-center perspective-1000">
            <div className="absolute top-10 right-10 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob"></div>
            <div className="absolute -bottom-10 left-10 w-64 h-64 bg-yellow-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000"></div>

            <div className="phone-mockup">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="p-4 bg-blue-50 border-b border-blue-100">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    Question 1 of 5
                  </div>
                  <div className="text-sm font-bold text-gray-800 mt-1">
                    What does GDG stand for?
                  </div>
                  <div className={`score-badge ${quizStep >= 3 ? "show" : ""}`}>
                    🎯 Score: 100
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div
                    className={`quiz-option ${quizStep >= 1 ? "selected" : ""} ${quizStep >= 2 ? "correct" : ""}`}>
                    <span className="font-bold mr-2">A.</span> Google Developer
                    Group
                  </div>
                  <div className="quiz-option">
                    <span className="font-bold mr-2">B.</span> Global Design
                    Guild
                  </div>
                  <div className="quiz-option">
                    <span className="font-bold mr-2">C.</span> Game Dev Group
                  </div>
                </div>
                <div
                  className={`celebration-overlay ${quizStep === 4 ? "active" : ""}`}>
                  <div className="text-6xl animate-bounce">🏆</div>
                  <div
                    className="confetti"
                    style={{ left: "20%", background: "#667eea" }}></div>
                  <div
                    className="confetti"
                    style={{
                      left: "50%",
                      background: "#f59e0b",
                      animationDelay: "0.1s",
                    }}></div>
                  <div
                    className="confetti"
                    style={{
                      left: "80%",
                      background: "#ec4899",
                      animationDelay: "0.2s",
                    }}></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="py-20 bg-white dark:bg-gray-900 transition-colors"
          ref={timelineRef}>
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
                How it Works
              </h2>
              <p className="text-gray-500 mt-2">Simple steps to join the fun</p>
            </div>
            <div className="relative">
              <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gray-100 dark:bg-gray-800 rounded-full"></div>
              {[
                {
                  id: "01",
                  title: "Join Event",
                  desc: "Enter the room code provided by host.",
                },
                {
                  id: "02",
                  title: "Think & Answer",
                  desc: "Select the correct option quickly.",
                },
                {
                  id: "03",
                  title: "Compete",
                  desc: "Race against time and peers.",
                },
                {
                  id: "04",
                  title: "Win Rewards",
                  desc: "Top the leaderboard & win swag!",
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={`timeline-item ${idx % 2 === 0 ? "left" : "right"}`}>
                  <div className="timeline-content">
                    <div className="text-4xl font-black text-gray-100 dark:text-gray-800 absolute -top-4 -right-2 z-0 pointer-events-none select-none">
                      {step.id}
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white relative z-10">
                      {step.title}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1 relative z-10">
                      {step.desc}
                    </p>
                  </div>
                  <div className="timeline-dot"></div>
                </div>
              ))}
            </div>
            <div className="text-center mt-16">
              <button
                onClick={() => router.push("/user")}
                className="px-10 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 dark:bg-blue-600 dark:hover:bg-blue-700 transition-all shadow-lg hover:-translate-y-1">
                Join Room Now
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <style jsx global>{`
        /* ✅ YOUR CUSTOM LOGO CSS */
        .logo img {
          height: 50px !important; /* Force override Next.js defaults */
          width: auto !important;
          display: block;
          object-fit: contain;
          transition: transform 0.3s ease;
        }
        .logo img:hover {
          transform: scale(1.05); /* Optional: add hover effect */
        }

        /* --- EXISTING STYLES --- */
        .page-container {
          background-image:
            linear-gradient(
              to right,
              rgba(8, 75, 162, 0.05) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(8, 75, 162, 0.05) 1px,
              transparent 1px
            );
          background-size: 40px 40px;
        }
        [data-theme="dark"] .page-container {
          background-color: #0f172a;
          background-image:
            linear-gradient(
              to right,
              rgba(255, 255, 255, 0.03) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(255, 255, 255, 0.03) 1px,
              transparent 1px
            );
        }
        .phone-mockup {
          width: 280px;
          height: 520px;
          background: white;
          border-radius: 36px;
          border: 8px solid #1f2937;
          position: relative;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          transform: rotate(-2deg);
          transition: transform 0.3s ease;
        }
        .phone-mockup:hover {
          transform: rotate(0deg) scale(1.02);
        }
        .phone-notch {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 120px;
          height: 24px;
          background: #1f2937;
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
          z-index: 20;
        }
        .quiz-option {
          padding: 12px;
          border-radius: 12px;
          background: #f3f4f6;
          border: 2px solid transparent;
          color: #374151;
          font-size: 0.875rem;
          transition: all 0.3s ease;
        }
        .quiz-option.selected {
          background: #dbeafe;
          border-color: #3b82f6;
          color: #1e40af;
        }
        .quiz-option.correct {
          background: #d1fae5;
          border-color: #10b981;
          color: #065f46;
        }
        .score-badge {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 12px;
          background: #fef3c7;
          color: #b45309;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: bold;
          opacity: 0;
          transform: scale(0.8);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .score-badge.show {
          opacity: 1;
          transform: scale(1);
        }
        .celebration-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }
        .celebration-overlay.active {
          opacity: 1;
        }
        .confetti {
          position: absolute;
          width: 8px;
          height: 16px;
          top: -20px;
          animation: fall 1.5s linear forwards;
        }
        @keyframes fall {
          to {
            transform: translateY(550px) rotate(720deg);
          }
        }
        .timeline-item {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 40px;
          position: relative;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.6s ease-out;
        }
        .animate-timeline .timeline-item {
          opacity: 1;
          transform: translateY(0);
        }
        .animate-timeline .timeline-item:nth-child(1) {
          transition-delay: 0.1s;
        }
        .animate-timeline .timeline-item:nth-child(2) {
          transition-delay: 0.3s;
        }
        .animate-timeline .timeline-item:nth-child(3) {
          transition-delay: 0.5s;
        }
        .animate-timeline .timeline-item:nth-child(4) {
          transition-delay: 0.7s;
        }
        .timeline-content {
          width: 45%;
          background: white;
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          position: relative;
          border: 1px solid #f3f4f6;
        }
        [data-theme="dark"] .timeline-content {
          background: #1f2937;
          border-color: #374151;
        }
        .timeline-dot {
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border-radius: 50%;
          border: 4px solid white;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          box-shadow: 0 0 0 2px #3b82f6;
          z-index: 10;
        }
        [data-theme="dark"] .timeline-dot {
          border-color: #0f172a;
        }
        .timeline-item.left {
          flex-direction: row;
        }
        .timeline-item.right {
          flex-direction: row-reverse;
        }
        .timeline-item.left .timeline-content {
          text-align: right;
          margin-right: auto;
        }
        .timeline-item.right .timeline-content {
          text-align: left;
          margin-left: auto;
        }
        @media (max-width: 768px) {
          .timeline-item,
          .timeline-item.right {
            flex-direction: row;
            justify-content: flex-start;
          }
          .timeline-content {
            width: 80%;
            margin-left: 30px !important;
            text-align: left !important;
          }
          .timeline-dot {
            left: 0;
            transform: none;
          }
          .absolute.left-1\\/2 {
            left: 8px;
          }
        }
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}
