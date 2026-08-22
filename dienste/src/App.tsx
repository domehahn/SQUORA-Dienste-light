import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { RequireAuth } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import Public from "./pages/Public";
import Login from "./pages/Login";
import DutyTypes from "./pages/admin/DutyTypes";
import Parents from "./pages/admin/Parents";
import Tournaments from "./pages/admin/Tournaments";
import TournamentDetail from "./pages/admin/TournamentDetail";
import Overview from "./pages/admin/Overview";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Public />} />
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route path="/admin" element={<AppLayout />}>
              <Route index element={<Navigate to="/admin/turniere" replace />} />
              <Route path="turniere" element={<Tournaments />} />
              <Route path="turniere/:id" element={<TournamentDetail />} />
              <Route path="eltern" element={<Parents />} />
              <Route path="dienste" element={<DutyTypes />} />
              <Route path="uebersicht" element={<Overview />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
