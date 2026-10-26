import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const appState = sqliteTable('app_state', {
  id: integer('id').primaryKey(),
  stateJson: text('state_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
