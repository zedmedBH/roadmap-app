// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';

// A simple wrapper to protect routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// A placeholder component for the Dashboard
const Dashboard = () => {
  const { user, logout } = useAuth();
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Welcome, {user?.firstName}!</h2>
      <p>Role: <span className="uppercase font-semibold text-blue-600">{user?.role}</span></p>
      <button onClick={logout} className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition">
        Log Out
      </button>
    </div>
  );
};

function AppRoutes() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="p-4 bg-blue-600 text-white font-bold flex justify-between items-center">
        <span>MYP Pacing LMS</span>
      </nav>

      <main className="p-4 max-w-6xl mx-auto">
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/journal" 
            element={
              <ProtectedRoute>
                <div>Engineering Journal (LaTeX) - Coming Soon</div>
              </ProtectedRoute>
            } 
          />
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