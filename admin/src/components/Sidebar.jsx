import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Users, MessageSquare, ClipboardList, Wallet, Smartphone, CreditCard, Settings, PackageOpen } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', Icon: BarChart3, end: true },
  { to: '/users', label: 'Users', Icon: Users },
  { to: '/sms', label: 'SMS Tasks', Icon: MessageSquare },
  { to: '/sms/logs', label: 'SMS Logs', Icon: ClipboardList },
  { to: '/withdrawals', label: 'Withdrawals', Icon: Wallet },
  { to: '/devices', label: 'Devices', Icon: Smartphone },
  { to: '/transactions', label: 'Transactions', Icon: CreditCard },
  { to: '/settings', label: 'Settings', Icon: Settings },
  { to: '/app-version', label: 'App Version', Icon: PackageOpen },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col min-h-screen">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-indigo-400">SMSPaisa</h1>
        <p className="text-xs text-slate-400 mt-1">Admin Panel</p>
      </div>
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.Icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
