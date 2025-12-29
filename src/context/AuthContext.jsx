import React, { createContext, useContext, useState } from "react";

const API = "http://localhost:5050";
const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("clinic_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  const saveUser = (data) => {
    setUser(data);
    localStorage.setItem("clinic_user", JSON.stringify(data));
  };

  const login = async (email, password, role) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Login failed");
        return false;
      }

      saveUser(data);
      return true;
    } catch (e) {
      console.error(e);
      alert("Error connecting to server");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("clinic_user");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
