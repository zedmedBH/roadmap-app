// src/components/Dashboard.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import StudentRosterImport from './Teacher/StudentRosterImport';
import GroupManagement from './Teacher/GroupManagement';
import TimelineView from './Timeline/TimelineView';
import StudentTaskBank from './Student/StudentTaskBank';
import TeacherTaskBank from './Teacher/TeacherTaskBank';

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
          <TimelineView />
          <TeacherTaskBank />
        </div>
      )}
      
      {/* Show Student-specific features */}
      {user?.role === 'student' && (
        <div className="grid grid-cols-1 gap-6">
          <TimelineView />
          <StudentTaskBank />
          {/* We will eventually add the Student's Personal Timeline here too! */}
        </div>
      )}
    </div>
  );
};

export default Dashboard;