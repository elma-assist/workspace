-- Apply the new naming algorithm to development data, without URL aliases.
-- Temporary values avoid collisions while reorganizing the unique namespace.
UPDATE organizations SET slug='_' || id::text;
DO $$ DECLARE row record; BEGIN
  FOR row IN SELECT id FROM organizations ORDER BY created_at, id LOOP
    UPDATE organizations SET slug=NULL WHERE id=row.id;
  END LOOP;
END $$;
