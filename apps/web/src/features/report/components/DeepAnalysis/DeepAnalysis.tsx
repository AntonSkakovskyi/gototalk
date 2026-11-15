import type { SessionDetails, SessionReport } from '@gototalk/shared';
import { Button, Collapse, Stack, Title } from '@mantine/core';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnswerList } from '@/features/report/components/AnswerList/AnswerList';
import { CategoryGroup } from '@/features/report/components/CategoryGroup/CategoryGroup';
import { groupByCategory } from '@/features/report/lib/group-by-category';
import { questionsByAnswer } from '@/features/report/lib/questions-by-answer';

const HIDE_MODE = 'display-none';

interface DeepAnalysisProps {
  details: SessionDetails;
  report: SessionReport;
}

export function DeepAnalysis({ details, report }: DeepAnalysisProps) {
  const { t } = useTranslation();
  const regionId = useId();
  const cleanTitleId = useId();
  const [expanded, setExpanded] = useState(false);
  const theory = new Map(
    report.categories.map(({ category, theoryLinks }) => [
      category,
      theoryLinks,
    ]),
  );
  const { groups, clean } = groupByCategory(details.utterances, theory);
  const questions = questionsByAnswer(details.utterances);

  if (groups.length === 0 && clean.length === 0) {
    return null;
  }

  return (
    <Stack gap="md">
      <Button
        variant="light"
        size="lg"
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => setExpanded((value) => !value)}
      >
        {t(expanded ? 'report.deep.close' : 'report.deep.open')}
      </Button>
      <Collapse expanded={expanded} keepMountedMode={HIDE_MODE} id={regionId}>
        <Stack gap="xl">
          <Title order={2}>{t('report.deep.title')}</Title>
          {groups.map((group) => (
            <CategoryGroup
              key={group.category}
              sessionId={details.id}
              group={group}
              questions={questions}
            />
          ))}
          {clean.length > 0 && (
            <Stack gap="md" component="section" aria-labelledby={cleanTitleId}>
              <Title order={3} size="h4" id={cleanTitleId}>
                {t('report.deep.cleanTitle')}
              </Title>
              <AnswerList
                sessionId={details.id}
                answers={clean}
                questions={questions}
                labelledBy={cleanTitleId}
              />
            </Stack>
          )}
        </Stack>
      </Collapse>
    </Stack>
  );
}
