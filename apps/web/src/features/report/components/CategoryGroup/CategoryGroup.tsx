import type { Utterance } from '@gototalk/shared';
import {
  Anchor,
  List,
  Stack,
  Text,
  Title,
  VisuallyHidden,
} from '@mantine/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AnswerList } from '@/features/report/components/AnswerList/AnswerList';
import type { CategoryGroupData } from '@/features/report/lib/group-by-category';
import classes from './CategoryGroup.module.scss';

const NO_MARKERS = 'none';
const EXTERNAL_LINK = {
  target: '_blank',
  rel: 'noopener noreferrer',
} as const;

interface CategoryGroupProps {
  sessionId: string;
  group: CategoryGroupData;
  questions: ReadonlyMap<string, Utterance>;
}

export function CategoryGroup({
  sessionId,
  group,
  questions,
}: CategoryGroupProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const theoryId = useId();

  return (
    <Stack gap="md" component="section" aria-labelledby={titleId}>
      <Title order={3} size="h4" id={titleId}>
        {t('report.deep.groupTitle', {
          category: t(`mistakeCategories.${group.category}`),
          count: group.count,
        })}
      </Title>
      {group.theoryLinks.length > 0 && (
        <Stack gap={0}>
          <Text size="sm" c="dimmed" id={theoryId}>
            {t('report.deep.theoryTitle')}
          </Text>
          <List listStyleType={NO_MARKERS} aria-labelledby={theoryId}>
            {group.theoryLinks.map((link) => (
              <List.Item key={link.id}>
                <Anchor
                  href={link.url}
                  {...EXTERNAL_LINK}
                  className={classes.theoryLink}
                >
                  {link.title}
                  <VisuallyHidden>
                    {' '}
                    ({t('report.deep.opensInNewTab')})
                  </VisuallyHidden>
                </Anchor>
              </List.Item>
            ))}
          </List>
        </Stack>
      )}
      <AnswerList
        sessionId={sessionId}
        answers={group.answers}
        questions={questions}
        labelledBy={titleId}
      />
    </Stack>
  );
}
