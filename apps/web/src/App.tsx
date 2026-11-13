import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './app/AppLayout';
import { ConsentPage } from './auth/ConsentPage';
import {
  PublicOnly,
  RequireAuth,
  RequireConsent,
  RequireNoConsent,
} from './auth/guards';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { HistoryPage } from './pages/HistoryPage';
import { ProfilePage } from './pages/ProfilePage';
import { SessionPage } from './pages/SessionPage';
import { WordsPage } from './pages/WordsPage';

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<RequireNoConsent />}>
          <Route path="consent" element={<ConsentPage />} />
        </Route>
        <Route element={<RequireConsent />}>
          <Route element={<AppLayout />}>
            <Route index element={<SessionPage />} />
            <Route path="words" element={<WordsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
