ALTER TABLE agents ADD COLUMN description text NOT NULL DEFAULT ''
    CHECK (char_length(description) <= 180);

UPDATE agents SET description = 'Helps Nordhaus residents with questions and repair requests.'
WHERE id = '9da2eff5-1275-5544-a5f9-8a71d59c7844';
