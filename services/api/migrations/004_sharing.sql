CREATE TABLE conversation_shares (
    id uuid PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES conversations(id),
    token_hash text NOT NULL UNIQUE,
    revoked boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversation_shares_conversation ON conversation_shares(conversation_id);
ALTER TABLE conversations ADD COLUMN run_share_id uuid REFERENCES conversation_shares(id);
