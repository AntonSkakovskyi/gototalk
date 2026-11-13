import { Navigate, Outlet } from 'react-router';
import { useSession } from '@/shared/session/session-store';

// While the session is unknown AuthBootstrap shows the loader, so guards render nothing.
export function RequireAuth() {
  const { status } = useSession();

  if (status === 'unknown') {
    return null;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function RequireConsent() {
  const { user } = useSession();

  if (user && !user.consentAt) {
    return <Navigate to="/consent" replace />;
  }
  return <Outlet />;
}

export function RequireNoConsent() {
  const { user } = useSession();

  if (user?.consentAt) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function PublicOnly() {
  const { user } = useSession();

  if (user) {
    return <Navigate to={user.consentAt ? '/' : '/consent'} replace />;
  }
  return <Outlet />;
}
