import { WORD_STATES } from '@gototalk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { uk } from '@/shared/i18n/resources';
import { mockApi } from '@/shared/testing/mock-api';
import {
  EMPTY_LEARNER_MODEL,
  TOP_FIVE_LEARNER_MODEL,
} from '@/shared/testing/fixtures/profile';
import { errorResponse, jsonResponse } from '@/shared/testing/http-responses';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { LearnerModelSection } from './LearnerModelSection';

const text = uk.profile.learnerModel;

const EXPECTED_ROWS = [
  { name: uk.mistakeCategories.articles, count: '7 разів' },
  { name: uk.mistakeCategories.prepositions, count: '5 разів' },
  { name: uk.mistakeCategories.verb_tense, count: '3 рази' },
  { name: uk.mistakeCategories.word_order, count: '2 рази' },
  { name: uk.mistakeCategories.l1_calque, count: '1 раз' },
];

function renderSection() {
  return renderWithProviders(<LearnerModelSection />);
}

function stubModel(model: unknown) {
  mockApi({ 'GET /api/profile/learner-model': jsonResponse(model) });
}

function patternsGroup() {
  return screen.findByRole('group', { name: text.weakAreas.title });
}

describe('LearnerModelSection', () => {
  it('[TC-02-05] lists exactly the returned patterns in order with names and counts', async () => {
    stubModel(TOP_FIVE_LEARNER_MODEL);
    renderSection();

    const list = within(await patternsGroup()).getByRole('list');
    const rows = within(list).getAllByRole('listitem');

    expect(rows).toHaveLength(EXPECTED_ROWS.length);
    EXPECTED_ROWS.forEach(({ name, count }, index) => {
      expect(rows[index]).toHaveTextContent(name);
      expect(rows[index]).toHaveTextContent(count);
    });
  });

  it('[TC-02-05] shows fewer rows when fewer patterns are returned', async () => {
    stubModel({
      ...TOP_FIVE_LEARNER_MODEL,
      weakAreas: TOP_FIVE_LEARNER_MODEL.weakAreas.slice(0, 2),
    });
    renderSection();

    const list = within(await patternsGroup()).getByRole('list');

    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('[TC-02-05] shows the vocabulary counters per word state', async () => {
    stubModel(TOP_FIVE_LEARNER_MODEL);
    renderSection();

    const group = await screen.findByRole('group', {
      name: text.vocabulary.title,
    });

    expect(
      within(group)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(WORD_STATES.map((state) => text.states[state]));
    expect(
      within(group)
        .getAllByRole('definition')
        .map((count) => count.textContent),
    ).toEqual(['12', '5', '3', '1']);
  });

  it('[TC-02-05] explains the empty state when there are no patterns and no words', async () => {
    stubModel(EMPTY_LEARNER_MODEL);
    renderSection();

    expect(await screen.findByText(text.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('[TC-02-05] shows only the patterns note when words exist but patterns do not', async () => {
    stubModel({
      ...EMPTY_LEARNER_MODEL,
      vocabulary: { ...EMPTY_LEARNER_MODEL.vocabulary, new: 4 },
    });
    renderSection();

    expect(await screen.findByText(text.weakAreas.empty)).toBeInTheDocument();
    expect(screen.queryByText(text.empty)).not.toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: text.vocabulary.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('[TC-02-05] announces loading and then shows the model', async () => {
    stubModel(TOP_FIVE_LEARNER_MODEL);
    renderSection();

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(uk.mistakeCategories.articles),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('[TC-02-05] shows an error with retry and recovers on retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    mockApi({
      'GET /api/profile/learner-model': () =>
        failing
          ? errorResponse(500, 'INTERNAL_ERROR')
          : jsonResponse(TOP_FIVE_LEARNER_MODEL),
    });
    renderSection();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );

    failing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(
      await screen.findByText(uk.mistakeCategories.articles),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
