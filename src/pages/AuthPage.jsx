import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";
import { motion } from "framer-motion";
import { LogIn, ArrowLeft } from "lucide-react";

const AuthPage = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const roleCap =
    role?.charAt(0).toUpperCase() + role?.slice(1).toLowerCase();

  useEffect(() => {
    if (![UserRole.SECRETARY, UserRole.DOCTOR].includes(roleCap)) {
      navigate("/");
    }
  }, [roleCap, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(email, password, roleCap);
    if (ok) navigate(`/${role}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-200 to-cyan-300 p-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md"
      >
        <h1 className="text-center text-3xl font-bold text-slate-800 mb-6">
          Login – {roleCap}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-slate-600 text-sm mb-1 block">Email</label>
            <input
              type="email"
              required
              className="w-full p-3 rounded-lg border border-slate-300"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-slate-600 text-sm mb-1 block">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full p-3 rounded-lg border border-slate-300"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="w-full bg-primary text-white py-3 rounded-lg flex items-center justify-center gap-2 text-lg">
            <LogIn />
            Login
          </button>
        </form>

        <div className="text-center mt-4">
          <Link to="/" className="inline-flex items-center text-slate-500">
            <ArrowLeft size={15} />
            <span className="ml-1">Back</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
