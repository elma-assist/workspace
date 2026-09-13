CREATE TABLE agent_event_outbox (
 id uuid PRIMARY KEY,
 path text NOT NULL CHECK(path LIKE '/api/internal/%'),
 body jsonb NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 locked_by uuid,
 locked_until timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_event_outbox_available
 ON agent_event_outbox(available_at,created_at)
 WHERE locked_until IS NULL;
