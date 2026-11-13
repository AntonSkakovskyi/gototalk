import {
  MAX_SCENES,
  SCENE_PRESETS,
  UpdateProfileRequestSchema,
} from '@gototalk/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import uk from '@/shared/i18n/uk.json';
import { mockApi } from '@/shared/testing/mock-api';
import {
  TEST_PROFILE,
  errorResponse,
  jsonResponse,
} from '@/shared/testing/test-fixtures';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { ProfileDetails } from './ProfileDetails';

const text = uk.profile.details;
const presets = uk.profile.scenes.presets;
const errors = uk.profile.onboarding.errors;
const customLabel = uk.profile.onboarding.scenes.customLabel;

const PROFILE = {
  ...TEST_PROFILE,
  scenes: ['work_meetings', 'Travel for work'],
};

type User = ReturnType<typeof userEvent.setup>;

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDetails() {
  return renderWithProviders(<ProfileDetails />);
}

function editButton() {
  return screen.getByRole('button', { name: text.editLabel });
}

function levelOption(level: string) {
  return screen.getByRole('radio', { name: new RegExp(`^${level}`) });
}

function sceneChip(name: string) {
  return screen.getByRole('checkbox', { name });
}

function save() {
  return screen.getByRole('button', { name: uk.profile.actions.save });
}

async function startEditing(user: User) {
  await user.click(await screen.findByRole('button', { name: text.editLabel }));
}

function stubProfile() {
  return mockApi({
    'GET /api/profile': jsonResponse(PROFILE),
    'PUT /api/profile': ({ body }) =>
      jsonResponse({ ...PROFILE, ...UpdateProfileRequestSchema.parse(body) }),
  });
}

describe('ProfileDetails view', () => {
  it('[TC-02-03] shows the level and scenes, labelling presets and keeping custom text', async () => {
    stubProfile();
    renderDetails();

    expect(
      await screen.findByText(uk.profile.levels.B1.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(uk.profile.levels.B1.description),
    ).toBeInTheDocument();
    expect(screen.getByText(presets.work_meetings)).toBeInTheDocument();
    expect(screen.getByText('Travel for work')).toBeInTheDocument();
    expect(screen.queryByText('work_meetings')).not.toBeInTheDocument();
  });

  it('[TC-02-03] announces loading before the profile arrives', async () => {
    stubProfile();
    renderDetails();

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
    expect(await screen.findByText(presets.work_meetings)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('[TC-02-03] treats a missing profile as an error with retry and recovers', async () => {
    const user = userEvent.setup();
    let missing = true;
    mockApi({
      'GET /api/profile': () =>
        missing
          ? errorResponse(404, 'PROFILE_NOT_FOUND')
          : jsonResponse(PROFILE),
    });
    renderDetails();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );

    missing = false;
    await user.click(
      screen.getByRole('button', { name: uk.common.actions.retry }),
    );

    expect(await screen.findByText(presets.work_meetings)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ProfileDetails edit', () => {
  it('[TC-02-03] shows a neutral level hint without the onboarding wording', async () => {
    const user = userEvent.setup();
    stubProfile();
    renderDetails();

    await startEditing(user);

    expect(screen.getByText(text.levelHint)).toBeInTheDocument();
    expect(
      screen.queryByText(uk.profile.onboarding.level.hint),
    ).not.toBeInTheDocument();
  });

  it('[TC-02-03] saves a changed level with unchanged scenes and shows it', async () => {
    const user = userEvent.setup();
    const { requests } = stubProfile();
    renderDetails();
    await startEditing(user);
    expect(levelOption('B1')).toBeChecked();

    await user.click(levelOption('B2'));
    await user.click(save());

    expect(
      await screen.findByText(uk.profile.levels.B2.title),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(requests.find(({ method }) => method === 'PUT')?.body).toEqual({
      level: 'B2',
      scenes: ['work_meetings', 'Travel for work'],
    });
    await waitFor(() => expect(editButton()).toHaveFocus());
  });

  it('[TC-02-04] adds a scene and drops another before saving', async () => {
    const user = userEvent.setup();
    const { requests } = stubProfile();
    renderDetails();
    await startEditing(user);

    await user.click(sceneChip('Travel for work'));
    await user.click(sceneChip(presets.travel));
    await user.type(screen.getByLabelText(customLabel), 'Cafe');
    await user.click(save());

    await waitFor(() => expect(editButton()).toBeInTheDocument());
    expect(requests.find(({ method }) => method === 'PUT')?.body).toEqual({
      level: 'B1',
      scenes: ['work_meetings', 'travel', 'Cafe'],
    });
  });

  it('[TC-02-04] blocks saving without scenes and shows the message', async () => {
    const user = userEvent.setup();
    const { requests } = stubProfile();
    renderDetails();
    await startEditing(user);

    await user.click(sceneChip(presets.work_meetings));
    await user.click(sceneChip('Travel for work'));
    await user.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      errors.scenesRequired,
    );
    expect(requests.some(({ method }) => method === 'PUT')).toBe(false);
  });

  it('[TC-02-04] blocks the seventh scene while editing', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/profile': jsonResponse({
        ...PROFILE,
        scenes: [...SCENE_PRESETS, 'Own one'],
      }),
    });
    renderDetails();
    await startEditing(user);

    await user.type(screen.getByLabelText(customLabel), 'Own two');
    await user.click(
      screen.getByRole('button', { name: uk.profile.onboarding.scenes.add }),
    );

    expect(
      screen.getByText(
        errors.scenesTooMany.replace('{{max}}', String(MAX_SCENES)),
      ),
    ).toBeInTheDocument();
  });

  it('[TC-02-03] cancel discards the draft and keeps the saved level', async () => {
    const user = userEvent.setup();
    const { requests } = stubProfile();
    renderDetails();
    await startEditing(user);
    await user.click(levelOption('C1'));

    await user.click(
      screen.getByRole('button', { name: uk.common.actions.cancel }),
    );

    expect(screen.getByText(uk.profile.levels.B1.title)).toBeInTheDocument();
    expect(requests.some(({ method }) => method === 'PUT')).toBe(false);
    await startEditing(user);
    expect(levelOption('B1')).toBeChecked();
  });

  it('[TC-02-03] shows a mapped error and keeps the form when saving fails', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/profile': jsonResponse(PROFILE),
      'PUT /api/profile': errorResponse(500, 'INTERNAL_ERROR'),
    });
    renderDetails();
    await startEditing(user);
    await user.click(levelOption('B2'));

    await user.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      uk.errors.generic,
    );
    expect(levelOption('B2')).toBeChecked();
    await waitFor(() => expect(save()).toBeEnabled());
  });
});
