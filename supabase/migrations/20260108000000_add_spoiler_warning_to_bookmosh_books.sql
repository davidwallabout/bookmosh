-- Add spoiler_warning column to bookmosh_books table
ALTER TABLE bookmosh_books
ADD COLUMN IF NOT EXISTS spoiler_warning BOOLEAN DEFAULT FALSE;

-- Create index for potential filtering
CREATE INDEX IF NOT EXISTS idx_bookmosh_books_spoiler_warning
ON bookmosh_books(owner, spoiler_warning);
