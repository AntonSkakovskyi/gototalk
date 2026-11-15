import { TOP_CATEGORIES_LIMIT, type SessionReport } from '@gototalk/shared';
import { Alert, Button, Group, List, Stack, Text, Title } from '@mantine/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

const NO_MARKERS = 'none';
const SECONDS_PER_MINUTE = 60;

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <Stack gap={0}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={500}>{value}</Text>
    </Stack>
  );
}

interface ReportSummaryProps {
  report: SessionReport;
  retrying: boolean;
  onRetry: () => void;
}

export function ReportSummary({
  report,
  retrying,
  onRetry,
}: ReportSummaryProps) {
  const { t } = useTranslation();
  const categoriesTitleId = useId();
  const minutes = Math.floor(report.durationSeconds / SECONDS_PER_MINUTE);
  const top = report.categories.slice(0, TOP_CATEGORIES_LIMIT);
  const { summary } = report;

  return (
    <Stack gap="md" component="section">
      <Title order={2}>{t('report.summary.title')}</Title>
      <Group gap="xl">
        <Stat
          label={t('report.summary.answersLabel')}
          value={t('report.summary.answers', { count: report.answers })}
        />
        <Stat
          label={t('report.summary.durationLabel')}
          value={
            minutes === 0
              ? t('report.summary.underMinute')
              : t('report.summary.minutes', { count: minutes })
          }
        />
      </Group>
      {summary.status === 'ready' && <Text>{summary.text}</Text>}
      {summary.status === 'no_answers' && (
        <Text>{t('report.summary.noAnswers')}</Text>
      )}
      {summary.status === 'unavailable' && (
        <Stack gap="sm" align="flex-start">
          <Alert color="yellow" role="status" w="100%">
            {t('report.summary.unavailable')}
          </Alert>
          <Button
            variant="light"
            size="lg"
            loading={retrying}
            disabled={retrying}
            onClick={onRetry}
          >
            {t('common.actions.retry')}
          </Button>
        </Stack>
      )}
      {top.length > 0 && (
        <Stack gap="xs">
          <Title order={3} size="h4" id={categoriesTitleId}>
            {t('report.summary.categoriesTitle')}
          </Title>
          <List listStyleType={NO_MARKERS} aria-labelledby={categoriesTitleId}>
            {top.map(({ category, count }) => (
              <List.Item key={category}>
                {t('report.summary.categoryLine', {
                  category: t(`mistakeCategories.${category}`),
                  count,
                })}
              </List.Item>
            ))}
          </List>
        </Stack>
      )}
      {top.length === 0 && report.answers > 0 && (
        <Text>{t('report.summary.noMistakes')}</Text>
      )}
    </Stack>
  );
}
