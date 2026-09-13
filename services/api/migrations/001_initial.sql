CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE users (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE organizations (
 id uuid PRIMARY KEY, name text NOT NULL, slug text UNIQUE NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
 org_id uuid REFERENCES organizations, user_id uuid REFERENCES users,
 role text NOT NULL CHECK(role IN ('owner','admin','employee')), PRIMARY KEY(org_id,user_id)
);
CREATE TABLE auth_sessions (
 token_hash text PRIMARY KEY, user_id uuid REFERENCES users,
 expires_at timestamptz NOT NULL
);
CREATE TABLE invitations (
 id uuid PRIMARY KEY, org_id uuid REFERENCES organizations, email text NOT NULL,
 name text NOT NULL, token_hash text UNIQUE NOT NULL, agent_ids uuid[] NOT NULL DEFAULT '{}',
 expires_at timestamptz NOT NULL, accepted_at timestamptz
);
CREATE TABLE knowledge_bases (
 id uuid PRIMARY KEY, org_id uuid REFERENCES organizations, name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id)
);
CREATE TABLE documents (
 id uuid PRIMARY KEY, org_id uuid REFERENCES organizations, kb_id uuid,
 name text NOT NULL, object_key text NOT NULL, body text NOT NULL,
 checksum text NOT NULL, status text NOT NULL DEFAULT 'uploaded', error text,
 attempts int NOT NULL DEFAULT 0, lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id),
 FOREIGN KEY(org_id,kb_id) REFERENCES knowledge_bases(org_id,id)
);
CREATE TABLE chunks (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, document_id uuid NOT NULL,
 position int NOT NULL, body text NOT NULL, embedding vector NOT NULL,
 model text NOT NULL, FOREIGN KEY(org_id,document_id) REFERENCES documents(org_id,id)
);
CREATE INDEX chunk_org ON chunks(org_id,document_id);
CREATE TABLE agents (
 id uuid PRIMARY KEY, org_id uuid REFERENCES organizations, name text NOT NULL,
 instruction text NOT NULL, kb_ids uuid[] NOT NULL DEFAULT '{}', config jsonb NOT NULL,
 version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id)
);
CREATE TABLE agent_access (
 org_id uuid NOT NULL, agent_id uuid NOT NULL, user_id uuid NOT NULL,
 PRIMARY KEY(org_id,agent_id,user_id),
 FOREIGN KEY(org_id,agent_id) REFERENCES agents(org_id,id),
 FOREIGN KEY(org_id,user_id) REFERENCES memberships(org_id,user_id)
);
CREATE TABLE publications (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, agent_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false, origins text[] NOT NULL DEFAULT '{}',
 UNIQUE(org_id,agent_id), FOREIGN KEY(org_id,agent_id) REFERENCES agents(org_id,id)
);
CREATE TABLE conversations (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, agent_id uuid NOT NULL,
 user_id uuid REFERENCES users, guest_hash text, title text NOT NULL DEFAULT 'New conversation',
 config jsonb NOT NULL, room_name text UNIQUE NOT NULL, status text NOT NULL DEFAULT 'created',
 created_at timestamptz NOT NULL DEFAULT now(), last_event_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,agent_id) REFERENCES agents(org_id,id)
);
CREATE TABLE messages (
 id text NOT NULL, conversation_id uuid REFERENCES conversations,
 role text NOT NULL CHECK(role IN ('user','assistant')), content text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(conversation_id,id)
);
CREATE TABLE sources (
 id uuid PRIMARY KEY, conversation_id uuid REFERENCES conversations, query text NOT NULL,
 document_id uuid REFERENCES documents, name text NOT NULL, excerpt text NOT NULL,
 score double precision NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE usage_ledger (
 id uuid PRIMARY KEY, org_id uuid REFERENCES organizations, agent_id uuid,
 conversation_id uuid REFERENCES conversations, provider text NOT NULL,
 request_id text NOT NULL, operation text NOT NULL, model text NOT NULL,
 quantities jsonb NOT NULL, tariff jsonb NOT NULL,
 cost numeric(20,10), price numeric(20,10), currency text NOT NULL DEFAULT 'USD',
 raw_usage jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,request_id,operation)
);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY, org_id uuid REFERENCES organizations, user_id uuid REFERENCES users,
 action text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
