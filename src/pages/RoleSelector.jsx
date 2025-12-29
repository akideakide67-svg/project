import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { UserRole } from "../types";
import { LayoutDashboard, User, ClipboardList, Stethoscope } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const RoleSelector = () => {
  const [isStaffMenuOpen, setIsStaffMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsStaffMenuOpen(false);
      }
    };

    if (isStaffMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isStaffMenuOpen]);

  return (
    <div 
      className="min-h-screen flex flex-col relative bg-slate-900"
      style={{
        backgroundImage: `url('/clinic-background.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Soft Overlay Gradient for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-teal-900/50 to-cyan-900/60"></div>
      
      {/* Staff Access Menu - Top Right */}
      <div className="relative p-4 flex justify-end z-50" ref={menuRef}>
        <button
          onClick={() => setIsStaffMenuOpen(!isStaffMenuOpen)}
          className="p-2 rounded-lg text-white/90 hover:bg-white/20 hover:text-white transition-colors backdrop-blur-sm bg-white/10 shadow-lg"
          aria-label="Staff Access Menu"
        >
          <LayoutDashboard size={24} />
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isStaffMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-12 right-4 bg-white/95 backdrop-blur-md rounded-lg shadow-2xl border border-white/20 py-2 min-w-[180px] z-50"
            >
              <Link
                to={`/auth/${UserRole.SECRETARY.toLowerCase()}`}
                className="flex items-center space-x-3 px-4 py-3 text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => setIsStaffMenuOpen(false)}
              >
                <ClipboardList size={20} className="text-slate-600" />
                <span className="font-medium">Secretary</span>
              </Link>
              <Link
                to={`/auth/${UserRole.DOCTOR.toLowerCase()}`}
                className="flex items-center space-x-3 px-4 py-3 text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => setIsStaffMenuOpen(false)}
              >
                <Stethoscope size={20} className="text-slate-600" />
                <span className="font-medium">Doctor</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content - Centered Patient Button */}
      <div className="flex-1 flex items-center justify-center px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-6 max-w-2xl"
        >
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-lg">
              Welcome to ClinicSys
            </h1>
            <p className="text-xl md:text-2xl text-white/90 drop-shadow-md font-light">
              Your trusted partner in healthcare management
            </p>
            <p className="text-lg text-white/80 drop-shadow-md max-w-xl mx-auto">
              Book appointments, manage your health records, and access your medical information with ease
            </p>
          </div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="inline-block mt-8"
          >
            <Link
              to="/patient"
              className="inline-flex items-center space-x-4 bg-primary text-white py-6 px-12 rounded-2xl text-2xl font-semibold shadow-2xl hover:bg-primary-dark hover:shadow-3xl transition-all duration-200 backdrop-blur-sm"
            >
              <User size={32} />
              <span>Patient Portal</span>
            </Link>
          </motion.div>

          <p className="text-sm text-white/70 mt-8 drop-shadow-sm">
            Staff members can access their portal via the menu above
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RoleSelector;
