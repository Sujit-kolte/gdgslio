"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 🟢 CONFIGURATION
// ✅ Make sure this URL matches your live Render Backend
const API_URL = "https://gdgslio.onrender.com/api";
// OR keep "https://gdgslio.onrender.com/api" if you didn't create a v2.

export default function AdminLogin() {
  const router = useRouter();

  const [passcode, setPasscode] = useState("");
  const [status, setStatus] = useState({ msg: "", type: "" }); // type: 'error' | 'loading'
  const [loading, setLoading] = useState(false);

  const verifyPasscode = async (e) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setStatus({ msg: "Please enter the admin passcode.", type: "error" });
      return;
    }

    setLoading(true);
    setStatus({ msg: "Verifying credentials...", type: "loading" });

    try {
      // 🟢 FIX: Changed URL from '/admin/login' to '/admin/verify-passcode'
      const response = await fetch(`${API_URL}/admin/verify-passcode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "admin-passcode": passcode.trim(), // Sending header correctly
        },
      });

      if (response.ok) {
        // ✅ Success
        sessionStorage.setItem("ADMIN_PASSCODE", passcode.trim());
        router.push("/admin/dashboard");
      } else {
        // ❌ Fail
        const data = await response.json();
        setStatus({ msg: data.message || "Invalid passcode.", type: "error" });
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setStatus({ msg: "Server error. Please try again.", type: "error" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 z-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#1a73e8 1px, transparent 1px), linear-gradient(90deg, #1a73e8 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage:
            "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
        }}></div>

      {/* Login Card */}
      <div className="w-[470px] bg-white rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] p-8 z-10 animate-[fadeUp_0.6s_ease-out] border border-gray-100">
        {/* Header */}
        <div className="text-center mb-7">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">
            Admin Verification
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Secure access to the admin dashboard
          </p>
        </div>

        <form onSubmit={verifyPasscode}>
          <label
            className="block mt-4 text-sm font-semibold text-gray-600"
            htmlFor="passcode">
            Admin Passcode
          </label>
          <input
            type="password"
            id="passcode"
            className="w-full mt-2 p-3 text-base rounded-xl border border-gray-300 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-gray-400"
            placeholder="Enter admin passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-7 p-3.5 rounded-xl border-none bg-blue-600 text-white text-base font-semibold cursor-pointer transition-all hover:-translate-y-px hover:shadow-lg hover:bg-gray-700 disabled:opacity-70 disabled:cursor-not-allowed">
            {loading ? "Verifying..." : "Verify & Login"}
          </button>
        </form>

        {/* Status Message */}
        {status.msg && (
          <div
            className={`mt-4 text-sm text-center font-medium ${
              status.type === "error"
                ? "text-red-500"
                : "text-gray-500 animate-pulse"
            }`}>
            {status.msg}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-5 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 no-underline hover:underline hover:text-gray-700 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Animation Styles */}
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
