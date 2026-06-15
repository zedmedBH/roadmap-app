import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* This is where your navigation bar will go later */}
      <nav className="p-4 bg-blue-600 text-white font-bold">
        MYP Pacing LMS
      </nav>

      <main className="p-4">
        <Routes>
          {/* Main Dashboard */}
          <Route path="/" element={<div>Welcome to the Timeline Dashboard</div>} />
          
          {/* Engineering Journal Route */}
          <Route path="/journal" element={<div>Engineering Journal (LaTeX)</div>} />
        </Routes>
      </main>
    </div>
  )
}

export default App