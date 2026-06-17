// src/components/Dashboard.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import StudentRosterImport from './Teacher/StudentRosterImport';
import GroupManagement from './Teacher/GroupManagement';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white rounded-lg shadow-md flex justify-between items-center border border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.firstName}!</h2>
          <p className="text-gray-600">
            Role: <span className="uppercase font-semibold text-blue-600">{user?.role}</span>
          </p>
        </div>
        <button 
          onClick={logout} 
          className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition"
        >
          Log Out
        </button>
      </div>

      {/* Show Teacher-specific features */}
      {user?.role === 'teacher' && (
        <div className="grid grid-cols-1 gap-6">
          <StudentRosterImport />
          <GroupManagement />
        </div>
      )}
      
      {/* Show Student-specific features */}
      {user?.role === 'student' && (
        <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
          <h3 className="text-xl font-bold mb-2">Student View</h3>
          <p className="text-gray-600">Your groups and timelines will appear here.</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;