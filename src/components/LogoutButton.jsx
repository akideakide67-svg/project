// src/components/LogoutButton.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LogoutButton = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    if (loading) return;
    setLoading(true);
    logout();
    navigate('/');
    setLoading(false);
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300"
    >
      <LogOut size={18} />
      <span>Logout</span>
    </button>
  );
};

export default LogoutButton;
