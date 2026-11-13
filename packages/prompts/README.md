# @gototalk/prompts

Language model prompts, one versioned file per prompt.

## Naming format

`<name>.vN.md`, for example `error-analysis.v1.md`. An existing file is not edited once results have been stored against it: changing a prompt creates a new version (`error-analysis.v2.md`).

## Version in data

The prompt version and the model are recorded on the utterance: `utterances.analysis_prompt_version` (for example, `error-analysis.v1`) and `utterances.analysis_model`.

## Contents

- `session-plan.v1.md`: plans a session (topic and five questions) from the learner profile. Id: `session-plan.v1`, the file name without `.md`. The learner data is inserted at the single `{{input}}` placeholder as JSON.
