import app from './uk/app.json';
import common from './uk/common.json';
import errors from './uk/errors.json';
import auth from './uk/auth.json';
import profile from './uk/profile.json';
import session from './uk/session.json';
import dialogue from './uk/dialogue.json';
import transcript from './uk/transcript.json';
import report from './uk/report.json';
import vocabulary from './uk/vocabulary.json';
import mistakeCategories from './uk/mistakeCategories.json';
import nav from './uk/nav.json';
import pages from './uk/pages.json';

export const resources = {
  uk: {
    translation: {
      app,
      common,
      errors,
      auth,
      profile,
      session,
      dialogue,
      transcript,
      report,
      vocabulary,
      mistakeCategories,
      nav,
      pages,
    },
  },
};

export const uk = resources.uk.translation;
