import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StudentRosterImport from './Teacher/StudentRosterImport';
import GroupManagement from './Teacher/GroupManagement';
import TimelineView from './Timeline/TimelineView';
import StudentTaskBank from './Student/StudentTaskBank';
import TeacherTaskBank from './Teacher/TeacherTaskBank';
import TeacherSettings from './Teacher/TeacherSettings';
import ClassManagement from './Teacher/ClassManagement';
import TeacherRubricBank from './Teacher/TeacherRubricBank';
import TeacherJournalReview from './Teacher/TeacherJournalReview';

const Dashboard: React.FC = () => {
  // logout removed from here since it's handled in App.tsx
  const { user, activeClassId } = useAuth();
  const [activeTab, setActiveTab] = useState<'roadmap' | 'grading' | 'curriculum' | 'setup'>('roadmap');
  const navigate = useNavigate();

  return (
    <div className="space-y-6 mt-2">
      {/* Teacher View */}
      {user?.role === 'teacher' && (
        <div className="flex flex-col gap-6">
          
          {/* Tab Navigation */}
          <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {[
              { id: 'roadmap', label: 'Master Roadmap' },
              { id: 'grading', label: 'Journal Grading' },
              { id: 'curriculum', label: 'Task & Rubric Banks' },
              { id: 'setup', label: 'Class Setup & Admin' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === tab.id 
                    ? 'border-blue-600 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Prompt to create class if missing */}
          {!activeClassId && activeTab !== 'setup' && (
            <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
              Please go to the <button onClick={() => setActiveTab('setup')} className="text-blue-600 underline">Class Setup & Admin</button> tab to select or create a class first.
            </div>
          )}

          {/* Tab Content */}
          <div className="w-full">
            {activeTab === 'roadmap' && activeClassId && <TimelineView />}
            {activeTab === 'grading' && activeClassId && <TeacherJournalReview />}
            {activeTab === 'curriculum' && activeClassId && (
              <div className="space-y-6">
                <TeacherTaskBank />
                <TeacherRubricBank />
              </div>
            )}
            {activeTab === 'setup' && (
              <div className="space-y-6">
                <ClassManagement />
                <TeacherSettings />
                {activeClassId && (
                  <>
                    <StudentRosterImport />
                    <GroupManagement />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Student View (Remains unified) */}
      {user?.role === 'student' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-md p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold mb-1">Your Engineering Journal</h3>
              <p className="text-blue-100 text-sm">
                Document your design process, track your active tasks, and view your grades all in one place.
              </p>
            </div>
            <button 
              onClick={() => navigate('/journal')}
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold shadow hover:bg-gray-50 transition whitespace-nowrap"
            >
              Open Journal
            </button>
          </div>
          <TimelineView />
          <StudentTaskBank />
        </div>
      )}
    </div>
  );
};

export default Dashboard;