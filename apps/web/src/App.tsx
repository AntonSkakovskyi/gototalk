import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './app/AppLayout.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { SessionPage } from './pages/SessionPage.js';
import { WordsPage } from './pages/WordsPage.js';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<SessionPage />} />
        <Route path="words" element={<WordsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
