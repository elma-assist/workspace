CREATE TABLE form_templates (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id),
 name text NOT NULL, description text NOT NULL DEFAULT '',
 definition jsonb NOT NULL, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id)
);
ALTER TABLE agents ADD COLUMN form_ids uuid[] NOT NULL DEFAULT '{}';
CREATE TABLE visitors (
 id uuid PRIMARY KEY, publication_id uuid NOT NULL REFERENCES publications(id),
 token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE conversations ADD COLUMN visitor_id uuid REFERENCES visitors(id);
CREATE TABLE requests (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id),
 form_id uuid NOT NULL REFERENCES form_templates(id), form_version integer NOT NULL,
 snapshot jsonb NOT NULL, conversation_id uuid NOT NULL REFERENCES conversations(id),
 user_id uuid REFERENCES users(id), visitor_id uuid REFERENCES visitors(id),
 answers jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','new','in_progress','waiting','closed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 submitted_at timestamptz
);
CREATE INDEX requests_org ON requests(org_id,created_at DESC);
CREATE INDEX requests_visitor ON requests(visitor_id);
CREATE UNIQUE INDEX one_draft_per_form ON requests(conversation_id,form_id) WHERE status='draft';
CREATE TABLE request_events (
 id uuid PRIMARY KEY, request_id uuid NOT NULL REFERENCES requests(id),
 actor text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE request_files (
 id uuid PRIMARY KEY, request_id uuid NOT NULL REFERENCES requests(id),
 field_id text NOT NULL, name text NOT NULL, object_key text NOT NULL,
 content_type text NOT NULL, size integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
