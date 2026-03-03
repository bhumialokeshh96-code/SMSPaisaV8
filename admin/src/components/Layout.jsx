import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useLocation } from 'react-router-dom';

const pageTitles = {
  '/': 'Dashboard',
  '/users': 'Users',
  '/sms': 'SMS Tasks',
  '/sms/logs': 'SMS Logs',
  '/withdrawals': 'Withdrawals',
  '/devices': 'Devices',
  '/transactions': 'Transactions',
  '/settings': 'Settings',
};

export default function Layout({ children }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] ||
    (location.pathname.startsWith('/users/') ? 'User Detail' : 'Admin Panel');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title={title} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
