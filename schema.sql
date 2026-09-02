CREATE SEQUENCE IF NOT EXISTS item_quote_number_seq START 1;

CREATE TABLE IF NOT EXISTS item_quotes (
  id UUID PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  share_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  client_company TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  cloned_from UUID NULL REFERENCES item_quotes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS item_quotes_updated_at_idx
  ON item_quotes(updated_at DESC);

CREATE INDEX IF NOT EXISTS item_quotes_client_company_idx
  ON item_quotes(client_company);
