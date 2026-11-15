import type { SessionDetails } from '@gototalk/shared';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reportQueryOptions } from '@/features/report/api/report-queries';
import {
  sessionDetailsQueryOptions,
  sessionKeys,
} from '@/shared/api/session-details';
import uk from '@/shared/i18n/uk.json';
import { createTestQueryClient } from '@/shared/testing/query-wrapper';
import { mockApi } from '@/shared/testing/mock-api';
import {
  jsonResponse,
  testMistake,
  testReport,
  testSessionDetails,
  testUtterance,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { DeepAnalysis } from './DeepAnalysis';

const REPORT = testReport();
const SESSION_ID = REPORT.sessionId;
const SESSION_PATH = `/api/sessions/${SESSION_ID}`;
const OPEN = uk.report.deep.open;
const MARK = uk.transcript.mistake.notMistake;

const QUESTION_1 = testUtterance({ id: 'q1', seq: 1, text: 'First question?' });
const QUESTION_2 = testUtterance({
  id: 'q2',
  seq: 3,
  text: 'Second question?',
});
const ANSWER_1 = testUtterance({
  id: 'a1',
  seq: 2,
  role: 'user',
  text: 'I go to the offsite yesterday',
  analysisStatus: 'done',
  mistakes: [testMistake()],
  better: [{ original: 'I go', better: 'I went' }],
});
const ANSWER_2 = testUtterance({
  id: 'a2',
  seq: 4,
  role: 'user',
  text: 'He go and I very like it',
  analysisStatus: 'done',
  mistakes: [
    testMistake({ id: 'm2', start: 3, end: 5, original: 'go' }),
    testMistake({
      id: 'm3',
      start: 10,
      end: 21,
      original: 'I very like',
      category: 'word_order',
    }),
  ],
  better: [{ original: 'I very like', better: 'I really like' }],
});

function details(overrides: Partial<SessionDetails> = {}): SessionDetails {
  return testSessionDetails({
    status: 'finished',
    utterances: [QUESTION_1, ANSWER_1, QUESTION_2, ANSWER_2],
    ...overrides,
  });
}

function renderDeep(session: SessionDetails = details()) {
  return renderWithProviders(
    <DeepAnalysis sessionId={SESSION_ID} details={session} report={REPORT} />,
  );
}

async function expand() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: OPEN }));
  await screen.findByRole('heading', { level: 2, name: uk.report.deep.title });
  return user;
}

function groupNamed(category: 'verb_tense' | 'word_order', count: number) {
  return screen.getByRole('region', {
    name: `${uk.mistakeCategories[category]} – ${count}`,
  });
}

describe('DeepAnalysis', () => {
  it('[TC-05-06] is collapsed by default and shows no fragments', () => {
    renderDeep();

    expect(screen.getByRole('button', { name: OPEN })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(
      screen.queryByRole('button', { name: 'go' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: uk.report.deep.title }),
    ).not.toBeInTheDocument();
  });

  it('[TC-05-06] expands on click, switches the label and points aria-controls at the region', async () => {
    renderDeep();
    await expand();

    const toggle = screen.getByRole('button', { name: uk.report.deep.close });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const region = document.getElementById(
      toggle.getAttribute('aria-controls') ?? '',
    );
    expect(region).toContainElement(
      screen.getByRole('heading', { level: 2, name: uk.report.deep.title }),
    );
  });

  it.each(['{Enter}', ' '])(
    '[TC-05-06] toggles from the keyboard with %j',
    async (key) => {
      const user = userEvent.setup();
      renderDeep();

      await user.tab();
      expect(screen.getByRole('button', { name: OPEN })).toHaveFocus();
      await user.keyboard(key);

      expect(
        screen.getByRole('button', { name: uk.report.deep.close }),
      ).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard(key);
      expect(screen.getByRole('button', { name: OPEN })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    },
  );

  it('[TC-05-06] shows the groups by category ordered by the mistake count', async () => {
    renderDeep();
    await expand();

    const titles = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-labelledby'))
      .map((id) => document.getElementById(id ?? '')?.textContent);
    expect(titles).toEqual([
      `${uk.mistakeCategories.verb_tense} – 2`,
      `${uk.mistakeCategories.word_order} – 1`,
    ]);
  });

  it('[TC-05-06] shows the theory links of the category as safe external links', async () => {
    renderDeep();
    await expand();

    const link = within(groupNamed('verb_tense', 2)).getByRole('link', {
      name: /Past Simple/,
    });
    expect(link).toHaveAttribute(
      'href',
      'https://example.com/theory/past-simple',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent(uk.report.deep.opensInNewTab);
    expect(
      within(groupNamed('word_order', 1)).queryByRole('link'),
    ).not.toBeInTheDocument();
  });

  it('[TC-05-06] highlights only the mistakes of the group category', async () => {
    renderDeep();
    await expand();

    const tense = groupNamed('verb_tense', 2);
    expect(within(tense).getAllByRole('button', { name: 'go' })).toHaveLength(
      2,
    );
    expect(
      within(tense).queryByRole('button', { name: 'I very like' }),
    ).not.toBeInTheDocument();
    const order = groupNamed('word_order', 1);
    expect(
      within(order).getByRole('button', { name: 'I very like' }),
    ).toBeInTheDocument();
    expect(
      within(order).queryByRole('button', { name: 'go' }),
    ).not.toBeInTheDocument();
  });

  it('[TC-05-06] shows every answer after its question', async () => {
    renderDeep();
    await expand();

    const list = within(groupNamed('verb_tense', 2)).getByRole('list', {
      name: `${uk.mistakeCategories.verb_tense} – 2`,
    });
    const items = Array.from(list.querySelectorAll(':scope > li'));
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(QUESTION_1.text);
    expect(items[0]).toHaveTextContent(ANSWER_1.text);
    expect(items[1]).toHaveTextContent(QUESTION_2.text);
  });

  it('[TC-05-06] opens the mistake details by clicking a fragment', async () => {
    renderDeep();
    const user = await expand();

    await user.click(
      within(groupNamed('word_order', 1)).getByRole('button', {
        name: 'I very like',
      }),
    );

    expect(screen.getByText(testMistake().explanationEn)).toBeInTheDocument();
  });

  it('[TC-04-11] highlights the mistakes although the session feedback is deferred', async () => {
    renderDeep(details({ feedbackMode: 'deferred' }));
    await expand();

    expect(
      within(groupNamed('verb_tense', 2)).getAllByRole('button', {
        name: 'go',
      }),
    ).toHaveLength(2);
  });

  it('[TC-05-06] shows the better phrasings once for an answer that is in two groups', async () => {
    renderDeep();
    await expand();

    expect(screen.getAllByText(uk.transcript.better.title)).toHaveLength(2);
    expect(screen.getAllByText('I really like')).toHaveLength(1);
  });

  it('[TC-05-06] lists answers without mistakes in their own section and notes a failed analysis', async () => {
    renderDeep(
      details({
        utterances: [
          QUESTION_1,
          ANSWER_1,
          QUESTION_2,
          testUtterance({
            id: 'a3',
            seq: 4,
            role: 'user',
            text: 'Because it is fun',
            analysisStatus: 'done',
          }),
          testUtterance({ id: 'q3', seq: 5, text: 'Third question?' }),
          testUtterance({
            id: 'a4',
            seq: 6,
            role: 'user',
            text: 'It is cheap',
            analysisStatus: 'failed',
          }),
        ],
      }),
    );
    await expand();

    const clean = screen.getByRole('region', {
      name: uk.report.deep.cleanTitle,
    });
    expect(within(clean).getByRole('heading', { level: 3 })).toHaveTextContent(
      uk.report.deep.cleanTitle,
    );
    const items = within(clean).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Because it is fun');
    expect(items[0]).not.toHaveTextContent(uk.report.deep.analysisFailed);
    expect(items[1]).toHaveTextContent('It is cheap');
    expect(items[1]).toHaveTextContent(uk.report.deep.analysisFailed);
    expect(within(clean).queryByRole('button')).not.toBeInTheDocument();
  });

  it('[TC-05-06] renders nothing when the session has no answers', () => {
    renderDeep(details({ utterances: [QUESTION_1] }));

    expect(
      screen.queryByRole('button', { name: OPEN }),
    ).not.toBeInTheDocument();
  });
});

function LiveHarness() {
  const session = useQuery(sessionDetailsQueryOptions(SESSION_ID));
  const report = useQuery(reportQueryOptions(SESSION_ID));
  if (!session.data || !report.data) {
    return null;
  }
  return (
    <DeepAnalysis
      sessionId={SESSION_ID}
      details={session.data}
      report={report.data}
    />
  );
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
