import { useState } from "react";
import { login, register } from "../services/auth.js";

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data =
        mode === "login"
          ? await login(username, password)
          : await register(username, password);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-spotify-black px-4">
      <div className="w-full max-w-sm sonic-surface rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-heading font-bold text-white text-center mb-2 tracking-tight">
          Varus Music
        </h1>
        <p className="text-spotify-lightgray text-center text-sm mb-8">
          The Digital Curator for your rotating playlist
        </p>

        <div className="flex rounded-xl overflow-hidden mb-6 border border-spotify-gray/90 bg-spotify-gray/30 p-1">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "login" ? "sonic-primary" : "text-spotify-lightgray hover:text-white"}`}
            onClick={() => setMode("login")}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "register" ? "sonic-primary" : "text-spotify-lightgray hover:text-white"}`}
            onClick={() => setMode("register")}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-spotify-lightgray mb-1 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-spotify-gray/85 text-white rounded-xl border border-spotify-gray/90 px-3 py-2 text-sm outline-none focus:border-spotify-green"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-xs text-spotify-lightgray mb-1 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-spotify-gray/85 text-white rounded-xl border border-spotify-gray/90 px-3 py-2 text-sm outline-none focus:border-spotify-green"
              placeholder={
                mode === "register" ? "Min. 8 characters" : "Enter password"
              }
            />
          </div>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 sonic-primary hover:brightness-110 disabled:opacity-50 font-bold py-2.5 rounded-pill transition"
          >
            {loading
              ? "Please wait…"
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
