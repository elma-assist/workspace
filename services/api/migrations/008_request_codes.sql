ALTER TABLE organizations ADD COLUMN request_counter bigint NOT NULL DEFAULT 0;
ALTER TABLE requests ADD COLUMN code text;
ALTER TABLE requests ADD COLUMN deleted_at timestamptz;

CREATE FUNCTION elma_request_code(n bigint) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE letters text := ''; prefix bigint := (n - 1) / 99 + 1;
BEGIN
  IF n < 1 THEN RAISE EXCEPTION 'Request number must be positive'; END IF;
  WHILE prefix > 0 LOOP
    letters := chr(65 + ((prefix - 1) % 26)::int) || letters;
    prefix := (prefix - 1) / 26;
  END LOOP;
  RETURN letters || lpad((((n - 1) % 99) + 1)::text, 2, '0');
END $$;

WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY created_at, id) AS n FROM requests
)
UPDATE requests r SET code = elma_request_code(numbered.n) FROM numbered WHERE numbered.id = r.id;
UPDATE organizations o SET request_counter = (SELECT count(*) FROM requests r WHERE r.org_id = o.id);
ALTER TABLE requests ALTER COLUMN code SET NOT NULL;
ALTER TABLE requests ADD CONSTRAINT requests_org_code UNIQUE (org_id, code);

CREATE FUNCTION elma_assign_request_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  UPDATE organizations SET request_counter = request_counter + 1 WHERE id = NEW.org_id
    RETURNING request_counter INTO n;
  NEW.code := elma_request_code(n);
  RETURN NEW;
END $$;
CREATE TRIGGER requests_assign_code BEFORE INSERT ON requests
FOR EACH ROW EXECUTE FUNCTION elma_assign_request_code();

DROP INDEX one_draft_per_form;
CREATE UNIQUE INDEX one_draft_per_form ON requests(conversation_id,form_id)
WHERE status='draft' AND deleted_at IS NULL;
