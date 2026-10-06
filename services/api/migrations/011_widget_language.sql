ALTER TABLE publications ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'de'));
