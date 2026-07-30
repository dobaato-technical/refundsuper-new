import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import Landing from "@/pages/Landing";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import BlogList from "@/pages/BlogList";
import BlogPost from "@/pages/BlogPost";
import { Toaster } from "@/components/ui/sonner";
import { isAuthed } from "@/lib/auth";

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "";

function ProtectedRoute({ children }) {
  if (!isAuthed()) return <Navigate to="/admin/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
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

function App() {
  const content = RECAPTCHA_SITE_KEY ? (
    <GoogleReCaptchaProvider
      reCaptchaKey={RECAPTCHA_SITE_KEY}
      scriptProps={{ async: true, defer: true, appendTo: "head" }}
    >
      <AppRoutes />
    </GoogleReCaptchaProvider>
  ) : (
    <AppRoutes />
  );
  return <HelmetProvider>{content}</HelmetProvider>;
}

export default App;
