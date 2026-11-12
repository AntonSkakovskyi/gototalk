# @gototalk/prompts

Language model prompts, one versioned file per prompt.

## Naming format

`<name>.vN.md`, for example `error-analysis.v1.md`. An existing file is not edited once results have been stored against it: changing a prompt creates a new version (`error-analysis.v2.md`).

## Version in data

The prompt version and the model are recorded on the utterance: `utterances.analysis_prompt_version` (for example, `error-analysis.v1`) and `utterances.analysis_model`.

## Contents

Empty for now: the first prompts will appear in specs 03–05.
