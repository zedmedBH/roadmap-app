// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Extracted Navigation to use AuthContext
function Navigation() {
  const { user, toggleViewRole, isViewingAsStudent } = useAuth();
  
  return (
    <nav className="p-4 bg-blue-600 text-white font-bold flex justify-between items-center">
      <span>MYP Pacing LMS</span>
      
      {/* Developer Toggle */}
      {(user?.role === 'teacher' || isViewingAsStudent) && (
        <button
          onClick={toggleViewRole}
          className="bg-white text-blue-600 px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-50 transition shadow-sm"
        >
          {isViewingAsStudent ? 'Return to Teacher View' : 'View as Student'}
        </button>
      )}
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
          <Route path="/journal" element={<ProtectedRoute><div>Engineering Journal (LaTeX) - Coming Soon</div></ProtectedRoute>} />
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