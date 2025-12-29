// src/App.jsx
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ClinicProvider } from './context/ClinicContext';
import { AuthProvider } from './context/AuthContext';

import SecretaryPage from './pages/SecretaryPage';
import DoctorPage from './pages/DoctorPage';
import PatientPage from './pages/PatientPage';
import RoleSelector from './pages/RoleSelector';
import AuthPage from './pages/AuthPage';
import ProtectedRoute from './components/ProtectedRoute';
import { UserRole } from './types';

const App = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <ClinicProvider>
          <Routes>
            <Route path="/" element={<RoleSelector />} />
            <Route path="/auth/:role" element={<AuthPage />} />

            <Route
              path="/secretary"
              element={
                <ProtectedRoute role={UserRole.SECRETARY}>
                  <SecretaryPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/doctor"
              element={
                <ProtectedRoute role={UserRole.DOCTOR}>
                  <DoctorPage />
                </ProtectedRoute>
              }
            />

            <Route path="/patient" element={<PatientPage />} />
          </Routes>
        </ClinicProvider>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
