import { useParams } from 'react-router';
import { SessionQuestion } from '@/features/session/components/SessionQuestion/SessionQuestion';

export function DialogPage() {
  const { id = '' } = useParams();

  return <SessionQuestion sessionId={id} />;
}
