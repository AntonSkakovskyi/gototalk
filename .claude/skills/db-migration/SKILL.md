---
name: db-migration
description: Procedure for any change to the GoToTalk PostgreSQL schema (new table, column, constraint, index). Use whenever a task needs a schema change; never change the schema any other way.
---

# Зміна схеми бази даних

Схема — джерело правди в SQL. TS-схема Drizzle лише відображає БД.

1. Переконайся, що зміна справді потрібна: перевір `docs/tech-decisions.md` (розділ 3) і наявні таблиці. Нові таблиці — лише після погодження з людиною.
2. Створи нову порожню кастомну міграцію через drizzle-kit (команду для стабільної гілки перевір через context7) з назвою `NNNN_short_description`.
3. Напиши SQL вручну:
   - усе в одній транзакції, якщо drizzle-kit не обгортає сам;
   - зберігай CHECK, UNIQUE, зовнішні ключі й `ON DELETE CASCADE` для даних користувача;
   - новим зовнішнім ключам — індекс;
   - не змінюй і не видаляй уже застосовані міграції.
4. Перевір на тестовій БД `gototalk_test`: застосуй усі міграції з нуля — без помилок.
5. Застосуй до dev-БД: `pnpm db:migrate`.
6. Онови TS-схему: `pnpm db:pull`. Переглянь diff `apps/api/src/core/db/schema.ts`; не правити його вручну.
7. Онови Zod-схеми в `packages/shared`, якщо змінились контракти.
8. Онови таблицю змін у `docs/tech-decisions.md` (розділ 3).
9. Додай інтеграційний тест, який перевіряє нове обмеження (наприклад, вставка невалідного значення падає).

Заборонено: `drizzle-kit push`, `drizzle-kit generate` з TS-схеми для звичайних змін, DROP/TRUNCATE поза міграцією, `podman compose down -v`.
