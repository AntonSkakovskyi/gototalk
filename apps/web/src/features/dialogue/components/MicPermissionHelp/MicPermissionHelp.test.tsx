import { screen } from '@testing-library/react';
import type { RecorderStatus } from '@/features/dialogue/hooks/use-audio-recorder';
import uk from '@/shared/i18n/uk.json';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { MicPermissionHelp } from './MicPermissionHelp';

interface Problem {
  errorName?: string | null;
  insecureContext?: boolean;
}

function renderHelp(
  status: RecorderStatus,
  { errorName = null, insecureContext = false }: Problem = {},
) {
  return renderWithProviders(
    <MicPermissionHelp
      status={status}
      errorName={errorName}
      insecureContext={insecureContext}
    />,
  );
}

describe('MicPermissionHelp', () => {
  it.each(['idle', 'requesting', 'recording'] as const)(
    '[TC-04-05] renders nothing while the status is %s',
    (status) => {
      renderHelp(status);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('[TC-04-14] explains a denied permission with a title, how to enable it and the text alternative', () => {
    renderHelp('denied', { errorName: 'NotAllowedError' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(uk.dialogue.voice.help.denied.title);
    expect(alert).toHaveTextContent(uk.dialogue.voice.help.denied.text);
    expect(alert).toHaveTextContent('Мікрофон');
    expect(alert).toHaveTextContent('відповісти текстом');
  });

  it('[TC-04-05] says HTTPS is needed on an insecure page', () => {
    renderHelp('unsupported', { insecureContext: true });

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(uk.dialogue.voice.help.insecure.title);
    expect(notice).toHaveTextContent('HTTPS');
  });

  it('[TC-04-05] says recording is unsupported in a secure context', () => {
    renderHelp('unsupported');

    expect(screen.getByRole('status')).toHaveTextContent(
      uk.dialogue.voice.help.unsupported.title,
    );
  });

  it('[TC-04-05] reports a missing microphone', () => {
    renderHelp('error', { errorName: 'NotFoundError' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      uk.dialogue.voice.help.notFound.title,
    );
  });

  it('[TC-04-05] reports a generic recording failure', () => {
    renderHelp('error', { errorName: 'NotReadableError' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      uk.dialogue.voice.help.error.title,
    );
  });
});
