import type { SessionDetails } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { uk } from '@/shared/i18n/resources';
import { testMistake, testUtterance } from '@/shared/testing/fixtures/session';
import { renderWithProviders } from '@/shared/testing/test-utils';
import {
  ANSWER_1,
  OPEN,
  QUESTION_1,
  QUESTION_2,
  REPORT,
  details,
  groupNamed,
} from '@/features/report/testing/deep-analysis-fixtures';
import { DeepAnalysis } from './DeepAnalysis';

function renderDeep(session: SessionDetails = details()) {
  return renderWithProviders(
    <DeepAnalysis details={session} report={REPORT} />,
  );
}

async function expand() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: OPEN }));
  await screen.findByRole('heading', { level: 2, name: uk.report.deep.title });
  return user;
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
