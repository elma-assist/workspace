-- Slugs are assigned in the database, including seed/import writes.
CREATE FUNCTION elma_slug_base(label text, fallback text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result text; item record;
BEGIN
  result := lower(label);
  result := replace(replace(replace(replace(result, 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss');
  FOR item IN SELECT key, value FROM jsonb_each_text(
    '{"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"shch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya","і":"i","ї":"yi","є":"ye","ґ":"g","ł":"l","ø":"o","æ":"ae","œ":"oe"}'::jsonb)
  LOOP result := replace(result, item.key, item.value); END LOOP;
  result := regexp_replace(lower(normalize(result, NFKD)), U&'[\0300-\036f]', '', 'g');
  result := trim(both '-' from left(regexp_replace(result, '[^a-z0-9]+', '-', 'g'), 48));
  RETURN coalesce(nullif(result, ''), fallback);
END $$;

ALTER TABLE agents ADD COLUMN slug text;

CREATE FUNCTION elma_assign_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE base text; candidate text; occupied boolean;
BEGIN
  IF nullif(NEW.slug, '') IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'organizations' THEN
    PERFORM pg_advisory_xact_lock(61726, 0);
    base := elma_slug_base(NEW.name, 'organization');
  ELSE
    PERFORM pg_advisory_xact_lock(61727, hashtext(NEW.org_id::text));
    base := elma_slug_base(NEW.name, 'agent');
  END IF;
  candidate := base;
  LOOP
    IF TG_TABLE_NAME = 'organizations' THEN
      SELECT EXISTS(SELECT 1 FROM organizations WHERE slug=candidate AND id<>NEW.id) INTO occupied;
    ELSE
      SELECT EXISTS(SELECT 1 FROM agents WHERE org_id=NEW.org_id AND slug=candidate AND id<>NEW.id) INTO occupied;
    END IF;
    EXIT WHEN NOT occupied;
    candidate := base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END $$;

CREATE TRIGGER organizations_slug BEFORE INSERT OR UPDATE OF slug ON organizations
FOR EACH ROW EXECUTE FUNCTION elma_assign_slug();
CREATE TRIGGER agents_slug BEFORE INSERT OR UPDATE OF slug ON agents
FOR EACH ROW EXECUTE FUNCTION elma_assign_slug();

-- Assign initial slugs to existing agents. Organization data is rebuilt in 007.
DO $$ DECLARE row record; BEGIN
  FOR row IN SELECT id FROM agents ORDER BY created_at, id LOOP
    UPDATE agents SET slug=NULL WHERE id=row.id;
  END LOOP;
END $$;
ALTER TABLE agents ALTER COLUMN slug SET NOT NULL;
ALTER TABLE agents ADD CONSTRAINT agents_org_slug_unique UNIQUE(org_id, slug);
ALTER TABLE agents ADD CONSTRAINT agents_slug_format CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=63);
