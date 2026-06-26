// src/App.tsx
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config/firebase';
import { AuthProvider, useAuth, type AppUser } from './context/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import EngineeringJournal from './components/Journal/EngineeringJournal';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Extracted Navigation to use AuthContext
function Navigation() {
  const { user, actualTeacherUser, setViewAsStudent, stopViewingAsStudent } = useAuth();
  const [students, setStudents] = useState<AppUser[]>([]);

  // Fetch students for the dropdown if we are a teacher
  useEffect(() => {
    const fetchStudents = async () => {
      if (user?.role === 'teacher' || actualTeacherUser) {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        const fetchedStudents = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
        setStudents(fetchedStudents);
      }
    };
    fetchStudents();
  }, [user?.role, actualTeacherUser]);

  const handleStudentSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const studentId = e.target.value;
    if (!studentId) return;
    
    // We also need to fetch the student's group so team tasks render properly in their view
    const student = students.find(s => s.id === studentId);
    if (student) {
      const groupSnap = await getDocs(query(collection(db, 'groups'), where('memberIds', 'array-contains', studentId)));
      const groupId = groupSnap.empty ? undefined : groupSnap.docs[0].id;
      setViewAsStudent({ ...student, groupId });
    }
  };
  
  return (
    <nav className="p-4 bg-blue-600 text-white font-bold flex justify-between items-center">
      <span>MYP Pacing LMS</span>
      
      {/* Developer Toggle / Student Selector */}
      <div className="flex items-center gap-3">
        {user?.role === 'teacher' && !actualTeacherUser && students.length > 0 && (
          <select 
            onChange={handleStudentSelect}
            className="bg-white text-blue-600 px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-50 transition shadow-sm outline-none cursor-pointer"
            value=""
          >
            <option value="" disabled>View as Student...</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
            ))}
          </select>
        )}

        {actualTeacherUser && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-200">
              Viewing as: {user?.firstName} {user?.lastName}
            </span>
            <button
              onClick={stopViewingAsStudent}
              className="bg-red-500 text-white border border-red-400 px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-red-600 transition shadow-sm"
            >
              Return to Teacher View
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="p-4 max-w-6xl mx-auto">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/journal" element={<ProtectedRoute><EngineeringJournal /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;