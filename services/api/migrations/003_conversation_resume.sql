ALTER TABLE conversations ADD COLUMN run_id uuid;
ALTER TABLE conversations ADD COLUMN active_request_id uuid REFERENCES requests(id);
ALTER TABLE conversations ADD COLUMN selection_version integer NOT NULL DEFAULT 0;
