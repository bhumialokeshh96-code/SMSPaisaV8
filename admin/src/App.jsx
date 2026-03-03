import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import SmsTasks from './pages/SmsTasks';
import SmsLogs from './pages/SmsLogs';
import Withdrawals from './pages/Withdrawals';
import Devices from './pages/Devices';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';

import AppVersion from './pages/AppVersion';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/users/:id" element={<UserDetail />} />
                  <Route path="/sms" element={<SmsTasks />} />
                  <Route path="/sms/logs" element={<SmsLogs />} />
                  <Route path="/withdrawals" element={<Withdrawals />} />
                  <Route path="/devices" element={<Devices />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/app-version" element={<AppVersion />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
