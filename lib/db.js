import { neon } from '@neondatabase/serverless';

let schemaPromise;

export function getDb() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  return neon(url);
}

export async function ensureSchema() {
  const db = getDb();
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db`CREATE TABLE IF NOT EXISTS pairs (
        id SERIAL PRIMARY KEY,
        invite_code VARCHAR(16) UNIQUE NOT NULL,
        scheduled_for TIMESTAMPTZ,
        scheduled_date DATE,
        opened_at TIMESTAMPTZ,
        nudge_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        name VARCHAR(60) NOT NULL,
        pin_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE TABLE IF NOT EXISTS partner_profiles (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        partner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fields JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (owner_user_id, partner_user_id)
      )`;
      await db`CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(10) NOT NULL CHECK (category IN ('sweet', 'hard')),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(128) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      )`;
      await db`CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(40) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, kind)
      )`;
      await db`CREATE TABLE IF NOT EXISTS ideas (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(30) NOT NULL,
        place VARCHAR(20) NOT NULL DEFAULT 'inside',
        body VARCHAR(300) NOT NULL,
        hidden_default BOOLEAN NOT NULL DEFAULT FALSE,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE TABLE IF NOT EXISTS talk_outcomes (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        result VARCHAR(20) NOT NULL CHECK (result IN ('resolved', 'not_yet')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE TABLE IF NOT EXISTS date_history (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(30) NOT NULL,
        place VARCHAR(20) NOT NULL DEFAULT 'inside',
        idea_text VARCHAR(300) NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'declined')),
        reason TEXT,
        alternative TEXT,
        reflection TEXT,
        repeat_wanted BOOLEAN,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE TABLE IF NOT EXISTS homework_cases (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
        problem TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMPTZ
      )`;
      await db`CREATE TABLE IF NOT EXISTS homework_answers (
        id SERIAL PRIMARY KEY,
        case_id INTEGER NOT NULL REFERENCES homework_cases(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (case_id, user_id)
      )`;
      await db`CREATE TABLE IF NOT EXISTS capsule_entries (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`;
      await db`CREATE TABLE IF NOT EXISTS agreements (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body VARCHAR(500) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'try' CHECK (status IN ('try', 'working', 'done', 'revisit')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE TABLE IF NOT EXISTS decision_options (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(40) NOT NULL DEFAULT 'food',
        body VARCHAR(300) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`;
      await db`CREATE TABLE IF NOT EXISTS decision_hidden_builtins (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        builtin_key VARCHAR(120) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (pair_id, builtin_key)
      )`;
      await db`CREATE TABLE IF NOT EXISTS small_wins (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body VARCHAR(500) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`;
      await db`CREATE TABLE IF NOT EXISTS site_feedback (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body VARCHAR(2000) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`;
      await db`CREATE TABLE IF NOT EXISTS game_rounds (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        question_key VARCHAR(80) NOT NULL,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        category VARCHAR(80) NOT NULL,
        challenge TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`;
      await db`ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS mode_key VARCHAR(40) NOT NULL DEFAULT 'know'`;
      await db`ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS mode_label VARCHAR(80) NOT NULL DEFAULT 'Котик знает?'`;
      await db`CREATE TABLE IF NOT EXISTS game_answers (
        id SERIAL PRIMARY KEY,
        round_id INTEGER NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        guess_index INTEGER NOT NULL,
        answer_index INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (round_id, user_id)
      )`;
      await db`CREATE TABLE IF NOT EXISTS wishes (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(20) NOT NULL DEFAULT 'general',
        body VARCHAR(500) NOT NULL,
        is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
        received BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE TABLE IF NOT EXISTS anniversary_ideas (
        id SERIAL PRIMARY KEY,
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body VARCHAR(500) NOT NULL,
        is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await db`CREATE TABLE IF NOT EXISTS pair_games_state (
        pair_id INTEGER NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
        game_key VARCHAR(40) NOT NULL,
        state JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (pair_id, game_key)
      )`;
      await db`ALTER TABLE wishes ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'general'`;
      await db`ALTER TABLE pairs ADD COLUMN IF NOT EXISTS scheduled_date DATE`;
      await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT`;
      await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb`;
      await db`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS hidden_default BOOLEAN NOT NULL DEFAULT FALSE`;
      await db`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS place VARCHAR(20) NOT NULL DEFAULT 'inside'`;
      await db`ALTER TABLE date_history ADD COLUMN IF NOT EXISTS place VARCHAR(20) NOT NULL DEFAULT 'inside'`;

      // A few early private deployments used `text`/`author_id` for the
      // shared-space tables. Bring those tables forward without dropping any
      // existing entries, so the current API can be deployed onto the same
      // Neon database.
      const schemaColumns = await db`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name IN ('capsule_entries', 'agreements', 'decision_options', 'small_wins')
      `;
      const legacyColumns = {};
      for (const table of ['capsule_entries', 'agreements', 'decision_options', 'small_wins']) {
        const columns = new Set(schemaColumns.filter((row) => row.table_name === table).map((row) => row.column_name));
        if (columns.has('text') && !columns.has('body')) {
          if (table === 'capsule_entries') await db`ALTER TABLE capsule_entries RENAME COLUMN "text" TO body`;
          if (table === 'agreements') await db`ALTER TABLE agreements RENAME COLUMN "text" TO body`;
          if (table === 'decision_options') await db`ALTER TABLE decision_options RENAME COLUMN "text" TO body`;
          if (table === 'small_wins') await db`ALTER TABLE small_wins RENAME COLUMN "text" TO body`;
          columns.add('body');
        }
        if (columns.has('author_id') && !columns.has('user_id')) {
          if (table === 'capsule_entries') await db`ALTER TABLE capsule_entries RENAME COLUMN author_id TO user_id`;
          if (table === 'agreements') await db`ALTER TABLE agreements RENAME COLUMN author_id TO user_id`;
          if (table === 'decision_options') await db`ALTER TABLE decision_options RENAME COLUMN author_id TO user_id`;
          if (table === 'small_wins') await db`ALTER TABLE small_wins RENAME COLUMN author_id TO user_id`;
          columns.add('user_id');
        }
        legacyColumns[table] = columns;
      }
      const capsuleColumns = legacyColumns.capsule_entries;
      if (!capsuleColumns.has('user_id')) await db`ALTER TABLE capsule_entries ADD COLUMN user_id INTEGER`;
      if (!capsuleColumns.has('source_note_id')) await db`ALTER TABLE capsule_entries ADD COLUMN source_note_id INTEGER`;
      if (!capsuleColumns.has('body')) await db`ALTER TABLE capsule_entries ADD COLUMN body TEXT`;
      if (!capsuleColumns.has('created_at')) await db`ALTER TABLE capsule_entries ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()`;
      if (!capsuleColumns.has('deleted_at')) await db`ALTER TABLE capsule_entries ADD COLUMN deleted_at TIMESTAMPTZ`;
      const agreementColumns = legacyColumns.agreements;
      if (!agreementColumns.has('user_id')) await db`ALTER TABLE agreements ADD COLUMN user_id INTEGER`;
      if (!agreementColumns.has('body')) await db`ALTER TABLE agreements ADD COLUMN body VARCHAR(500)`;
      if (!agreementColumns.has('status')) await db`ALTER TABLE agreements ADD COLUMN status VARCHAR(20) DEFAULT 'try'`;
      if (!agreementColumns.has('created_at')) await db`ALTER TABLE agreements ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()`;
      if (!agreementColumns.has('updated_at')) await db`ALTER TABLE agreements ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()`;
      const decisionColumns = legacyColumns.decision_options;
      if (!decisionColumns.has('user_id')) await db`ALTER TABLE decision_options ADD COLUMN user_id INTEGER`;
      if (!decisionColumns.has('kind')) await db`ALTER TABLE decision_options ADD COLUMN kind VARCHAR(40) NOT NULL DEFAULT 'food'`;
      if (!decisionColumns.has('body')) await db`ALTER TABLE decision_options ADD COLUMN body VARCHAR(300)`;
      if (!decisionColumns.has('created_at')) await db`ALTER TABLE decision_options ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()`;
      if (!decisionColumns.has('deleted_at')) await db`ALTER TABLE decision_options ADD COLUMN deleted_at TIMESTAMPTZ`;
      const winColumns = legacyColumns.small_wins;
      if (!winColumns.has('user_id')) await db`ALTER TABLE small_wins ADD COLUMN user_id INTEGER`;
      if (!winColumns.has('body')) await db`ALTER TABLE small_wins ADD COLUMN body VARCHAR(500)`;
      if (!winColumns.has('created_at')) await db`ALTER TABLE small_wins ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()`;
      if (!winColumns.has('deleted_at')) await db`ALTER TABLE small_wins ADD COLUMN deleted_at TIMESTAMPTZ`;
      await db`CREATE INDEX IF NOT EXISTS notes_pair_idx ON notes(pair_id, created_at)`;
      await db`CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)`;
      await db`CREATE INDEX IF NOT EXISTS ideas_pair_idx ON ideas(pair_id, kind, place, deleted_at)`;
      await db`CREATE INDEX IF NOT EXISTS talk_outcomes_pair_idx ON talk_outcomes(pair_id, created_at)`;
      await db`CREATE INDEX IF NOT EXISTS date_history_pair_idx ON date_history(pair_id, created_at)`;
      await db`CREATE INDEX IF NOT EXISTS homework_pair_idx ON homework_cases(pair_id, closed_at, created_at)`;
      await db`CREATE INDEX IF NOT EXISTS capsule_pair_idx ON capsule_entries(pair_id, user_id, deleted_at, created_at)`;
      await db`CREATE INDEX IF NOT EXISTS agreements_pair_idx ON agreements(pair_id, updated_at)`;
      await db`CREATE INDEX IF NOT EXISTS decisions_pair_idx ON decision_options(pair_id, kind, deleted_at)`;
      await db`CREATE INDEX IF NOT EXISTS decision_hidden_pair_idx ON decision_hidden_builtins(pair_id, builtin_key)`;
      await db`CREATE INDEX IF NOT EXISTS wins_pair_idx ON small_wins(pair_id, deleted_at, created_at)`;
      await db`CREATE INDEX IF NOT EXISTS feedback_pair_idx ON site_feedback(pair_id, deleted_at, created_at)`;
      await db`CREATE INDEX IF NOT EXISTS game_rounds_pair_idx ON game_rounds(pair_id, completed_at, created_at)`;
      await db`CREATE INDEX IF NOT EXISTS game_answers_round_idx ON game_answers(round_id, user_id)`;
      await db`CREATE INDEX IF NOT EXISTS wishes_pair_idx ON wishes(pair_id, kind, user_id, updated_at)`;
      await db`CREATE INDEX IF NOT EXISTS anniversary_ideas_pair_idx ON anniversary_ideas(pair_id, is_hidden, updated_at)`;
      await db`CREATE INDEX IF NOT EXISTS partner_profiles_owner_idx ON partner_profiles(owner_user_id, partner_user_id)`;
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
  return db;
}
