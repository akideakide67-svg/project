import React from 'react';
import LogoutButton from './LogoutButton';

/**
 * Global Layout Wrapper
 * Wraps every page with:
 * - Header
 * - Page Title
 * - Logout button (only if logged in)
 * - Content container
 */
const Layout = ({ title, children, showLogout = true }) => {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">

          {/* Page Title */}
          <h1 className="text-2xl font-bold text-primary">
            {title || "Clinic System"}
          </h1>

          {/* Logout Button */}
          {showLogout && <LogoutButton />}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 flex-grow">
        {children}
      </main>
    </div>
  );
};

export default Layout;
