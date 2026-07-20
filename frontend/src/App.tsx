import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import ReportRunDetails from "./pages/ReportRunDetails";
import AppShell from "./components/AppShell";

function ProtectedAppPage({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><AppShell>{children}</AppShell></ProtectedRoute>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedAppPage><Dashboard /></ProtectedAppPage>
          }
        />

        <Route path="*" element={<Navigate to="/login" />} />

        <Route path="/projects" element={<ProtectedAppPage><Projects /></ProtectedAppPage>} />

        <Route
          path="/projects/:id"
          element={
            <ProtectedAppPage><ProjectDetails /></ProtectedAppPage>
          }
        />

        <Route
          path="/reports/:reportRunId"
          element={
            <ProtectedAppPage><ReportRunDetails /></ProtectedAppPage>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
