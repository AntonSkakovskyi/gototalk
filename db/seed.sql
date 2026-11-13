-- Demo data for development. Apply after all migrations (the plan column comes from 0003); safe to re-run.
-- Re-running resets the demo user's profile and goals to the seeded values, so older seeded databases converge to preset scene codes.
-- Demo user: demo@gototalk.local, password demo-password-1 (local development only).
-- Mistake categories come from mistake_categories (0002); mistake positions are offsets in text_verbatim.

BEGIN;

INSERT INTO users (id, email, password_hash, consent_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'demo@gototalk.local', '$argon2id$v=19$m=65536,t=3,p=4$lPbRvUtjmzFnlkAE1P11iw$tedj1oA7L8bdmhHFYBNu6SMN+hXHeq0Y5HfwpYONhwk', now())
ON CONFLICT DO NOTHING;

INSERT INTO profiles (user_id, level, scenes, interface_lang) VALUES
  ('00000000-0000-4000-8000-000000000001', 'B1', ARRAY['work_meetings', 'small_talk'], 'uk')
ON CONFLICT (user_id) DO UPDATE SET level = EXCLUDED.level, scenes = EXCLUDED.scenes, interface_lang = EXCLUDED.interface_lang, updated_at = now();

INSERT INTO goals (id, user_id, title, scene, status) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Вільно говорити на мітингах', 'work_meetings', 'active'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Підтримувати small talk з колегами', 'small_talk', 'active')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status, scene = EXCLUDED.scene;

INSERT INTO theory_links (id, category, title, url) VALUES
  ('00000000-0000-4000-8000-000000000201', 'articles', 'A/an and the (Cambridge Dictionary)', 'https://dictionary.cambridge.org/grammar/british-grammar/a-an-and-the'),
  ('00000000-0000-4000-8000-000000000202', 'verb_tense', 'Past simple (Cambridge Dictionary)', 'https://dictionary.cambridge.org/grammar/british-grammar/past-simple'),
  ('00000000-0000-4000-8000-000000000203', 'prepositions', 'At, on and in: time (Cambridge Dictionary)', 'https://dictionary.cambridge.org/grammar/british-grammar/at-on-and-in-time'),
  ('00000000-0000-4000-8000-000000000204', 'subject_verb_agreement', 'Subject–verb agreement (Cambridge Dictionary)', 'https://dictionary.cambridge.org/grammar/british-grammar/subject-verb-agreement')
ON CONFLICT DO NOTHING;

INSERT INTO mistake_patterns (id, user_id, category, description, frequency, last_seen_at, theory_link_id) VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'articles', 'Пропуск артикля перед злічуваним іменником', 3, now() - interval '1 day', '00000000-0000-4000-8000-000000000201'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', 'verb_tense', 'Теперішній час замість минулого з маркером минулого', 2, now() - interval '1 day', '00000000-0000-4000-8000-000000000202'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', 'prepositions', 'Хибні прийменники (for/since, on/of)', 3, now() - interval '1 day', '00000000-0000-4000-8000-000000000203'),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000001', 'word_order', 'Хибне місце прислівника', 1, now() - interval '1 day', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO sessions (id, user_id, topic, topic_source, feedback_mode, status, started_at, ended_at, plan) VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'My last project at work', 'suggested', 'immediate', 'finished', now() - interval '1 day', now() - interval '1 day' + interval '4 minutes',
   '{"questions":["Tell me about your last project at work.","Which part of the project was the most difficult for you?","How did your team share the work?","What did you learn from the project?","What would you do differently next time?"]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET plan = EXCLUDED.plan;

INSERT INTO utterances (id, session_id, seq, role, text_verbatim, text_clean, analysis_status, analysis_prompt_version, analysis_model, analyzed_at, created_at) VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301', 1, 'assistant', 'Tell me about your last project at work.', NULL, 'skipped', NULL, NULL, NULL, now() - interval '1 day' + interval '1 minutes'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000301', 2, 'user', 'Um, yesterday I go to the office and, uh, I have a meeting with my team. I very like my job.', 'Yesterday I go to the office and I have a meeting with my team. I very like my job.', 'done', 'fake-v1', 'fake', now() - interval '1 day', now() - interval '1 day' + interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000301', 3, 'assistant', 'Which part of the project was the most difficult for you?', NULL, 'skipped', NULL, NULL, NULL, now() - interval '1 day' + interval '3 minutes'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000301', 4, 'user', 'Well, I work with small team since 2 years. It depends of the deadline.', 'I work with small team since 2 years. It depends of the deadline.', 'done', 'fake-v1', 'fake', now() - interval '1 day', now() - interval '1 day' + interval '4 minutes')
ON CONFLICT DO NOTHING;

INSERT INTO mistakes (id, utterance_id, pattern_id, category, original, suggestion, explanation_en, translation_uk, start_pos, end_pos) VALUES
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000302', 'verb_tense', 'I go', 'I went', 'Use the past simple for finished actions with a past time marker.', 'Для завершених дій з маркером минулого вживається Past Simple.', 14, 18),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000304', 'word_order', 'I very like', 'I really like', '"Very" does not go before a verb; use "really" or "very much" after the object.', '«Very» не ставиться перед дієсловом; вживайте «really» або «very much».', 73, 84),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000301', 'articles', 'with small team', 'with a small team', 'A singular countable noun needs an article.', 'Злічуваному іменнику в однині потрібен артикль.', 13, 28),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000303', 'prepositions', 'since 2 years', 'for 2 years', 'Use "for" with a period of time and "since" with a starting point.', '«For» – для тривалості, «since» – для моменту початку.', 29, 42),
  ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000303', 'prepositions', 'depends of', 'depends on', 'The verb "depend" takes the preposition "on".', 'Дієслово «depend» вживається з прийменником «on».', 47, 57)
ON CONFLICT DO NOTHING;

INSERT INTO words (id, user_id, lemma, translation_uk, state, source, times_used, last_used_at) VALUES
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', 'deadline', 'крайній термін', 'new', 'hint', 0, NULL),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000001', 'schedule', 'розклад', 'partial', 'session', 1, now() - interval '3 days'),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000001', 'meeting', 'зустріч', 'passive', 'user', 0, NULL),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000001', 'colleague', 'колега', 'active', 'session', 2, now() - interval '1 day')
ON CONFLICT DO NOTHING;

INSERT INTO hints (id, session_id, utterance_id, kind, text, word_id) VALUES
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000204', 'translation', 'deadline = крайній термін', '00000000-0000-4000-8000-000000000501')
ON CONFLICT DO NOTHING;

INSERT INTO session_reports (session_id, summary, deep_analysis) VALUES
  ('00000000-0000-4000-8000-000000000301', 'Ви відповіли 2 рази за 4 хв. Найчастіші помилки: Прийменники, Артиклі, Часи дієслів. Зосередьтеся на категорії «Прийменники» у наступній сесії.', '{"categories":[{"code":"prepositions","count":2},{"code":"articles","count":1},{"code":"verb_tense","count":1},{"code":"word_order","count":1}]}'::jsonb)
ON CONFLICT DO NOTHING;

COMMIT;
