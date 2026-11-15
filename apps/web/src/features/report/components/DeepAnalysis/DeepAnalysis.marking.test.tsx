import type { SessionDetails } from '@gototalk/shared';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reportQueryOptions } from '@/features/report/api/report-queries';
import {
  sessionDetailsQueryOptions,
  sessionKeys,
} from '@/entities/session/api/session-details';
import uk from '@/shared/i18n/uk.json';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import { mockApi } from '@/shared/testing/mock-api';
import { jsonResponse } from '@/shared/testing/http-responses';
import { testMistake } from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import {
  ANSWER_1,
  OPEN,
  QUESTION_1,
  REPORT,
  SESSION_ID,
  SESSION_PATH,
  details,
  groupNamed,
} from './deep-analysis-fixtures';
import { DeepAnalysis } from './DeepAnalysis';

const MARK = uk.transcript.mistake.notMistake;

function LiveHarness() {
  const session = useQuery(sessionDetailsQueryOptions(SESSION_ID));
  const report = useQuery(reportQueryOptions(SESSION_ID));
  if (!session.data || !report.data) {
    return null;
  }
  return <DeepAnalysis details={session.data} report={report.data} />;
}

describe('DeepAnalysis marking a mistake as not a mistake', () => {
  async function setup(session: SessionDetails) {
    const { requests } = mockApi({
      [`GET ${SESSION_PATH}/report`]: () => jsonResponse(REPORT),
      [`PATCH ${SESSION_PATH}/mistakes/${testMistake().id}`]: () =>
        jsonResponse(testMistake({ isFalse: true })),
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sessionKeys.details(SESSION_ID), session);
    renderWithProviders(<LiveHarness />, { queryClient });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: OPEN }));
    await screen.findByRole('heading', {
      level: 2,
      name: uk.report.deep.title,
    });
    return { requests, user };
  }

  const reportRequests = (requests: { path: string }[]) =>
    requests.filter(({ path }) => path.endsWith('/report')).length;

  it('[TC-05-03] removes the mistake from its group at once and asks for a fresh report', async () => {
    const { requests, user } = await setup(details());
    const before = reportRequests(requests);

    const [first] = within(groupNamed('verb_tense', 2)).getAllByRole('button', {
      name: 'go',
    });
    await user.click(first as HTMLElement);
    await user.click(screen.getByRole('button', { name: MARK }));

    await waitFor(() =>
      expect(
        within(groupNamed('verb_tense', 1)).getAllByRole('button', {
          name: 'go',
        }),
      ).toHaveLength(1),
    );
    await waitFor(() =>
      expect(reportRequests(requests)).toBeGreaterThan(before),
    );
  });

  it('[TC-05-03] removes the group when its last mistake is marked and keeps the answer among the clean ones', async () => {
    const { user } = await setup(
      details({ utterances: [QUESTION_1, ANSWER_1] }),
    );

    await user.click(screen.getByRole('button', { name: 'go' }));
    await user.click(screen.getByRole('button', { name: MARK }));

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', {
          level: 3,
          name: `${uk.mistakeCategories.verb_tense} – 1`,
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(
        screen.getByRole('region', { name: uk.report.deep.cleanTitle }),
      ).getByText(ANSWER_1.text),
    ).toBeInTheDocument();
  });
});
