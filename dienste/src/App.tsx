import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { RequireAuth } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import Login from "./pages/Login";
import Jugenden from "./pages/admin/Jugenden";
import Players from "./pages/admin/Players";
import DutyTypes from "./pages/admin/DutyTypes";
import Parents from "./pages/admin/Parents";
import ParentDetail from "./pages/admin/ParentDetail";
import Tournaments from "./pages/admin/Tournaments";
import TournamentDetail from "./pages/admin/TournamentDetail";
import Overview from "./pages/admin/Overview";
import Users from "./pages/admin/Users";
import Inventory from "./pages/admin/Inventory";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route path="/admin" element={<AppLayout />}>
              <Route index element={<Navigate to="/admin/turniere" replace />} />
              <Route path="jugenden" element={<Jugenden />} />
              <Route path="spieler" element={<Players />} />
              <Route path="turniere" element={<Tournaments />} />
              <Route path="turniere/:id" element={<TournamentDetail />} />
              <Route path="eltern" element={<Parents />} />
              <Route path="eltern/:id" element={<ParentDetail />} />
              <Route path="dienste" element={<DutyTypes />} />
              <Route path="lager" element={<Inventory />} />
              <Route path="uebersicht" element={<Overview />} />
              <Route path="nutzer" element={<Users />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
