import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import { Toaster } from "@/components/ui/sonner";
import { isAuthed } from "@/lib/auth";

function ProtectedRoute({ children }) {
  if (!isAuthed()) return <Navigate to="/admin/login" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
