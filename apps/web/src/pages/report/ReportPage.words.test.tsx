import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAppWithProbe } from '@/app/router/guards/guard-test-helpers';
import uk from '@/shared/i18n/uk.json';
import { jsonResponse, testWord } from '@/shared/testing/test-fixtures';
import { AUTH, FINISHED, ROUTE, mockReportApi } from './report-page-setup';

function renderReport(...args: Parameters<typeof mockReportApi>) {
  const api = mockReportApi(...args);
  renderAppWithProbe({ route: ROUTE, session: AUTH });
  return api;
}

describe('ReportPage session words', () => {
  it('[TC-05-05] shows the session words between the summary and the deep analysis', async () => {
    renderReport(jsonResponse(FINISHED));

    const summary = await screen.findByRole('heading', {
      level: 2,
      name: uk.report.summary.title,
    });
    const words = screen.getByRole('heading', {
      level: 2,
      name: uk.vocabulary.session.title,
    });
    const toggle = screen.getByRole('button', { name: uk.report.deep.open });

    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
    expect(
      summary.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      words.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('[TC-05-05] marks a word on the report page', async () => {
    const user = userEvent.setup();
    const { requests } = renderReport(jsonResponse(FINISHED));

    const [first] = await screen.findAllByRole('radiogroup');
    await user.click(
      within(first as HTMLElement).getByRole('radio', {
        name: uk.vocabulary.marks.passive,
      }),
    );

    await waitFor(() =>
      expect(
        requests.filter((request) => request.method === 'PATCH'),
      ).toHaveLength(1),
    );
    expect(requests.filter((request) => request.method === 'PATCH')).toEqual([
      expect.objectContaining({
        path: `/api/words/${testWord().id}`,
        body: { state: 'passive' },
      }),
    ]);
  });
});
