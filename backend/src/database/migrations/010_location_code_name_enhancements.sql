-- ====================================================================
-- PANTONE FIXED ASSET MANAGEMENT SYSTEM - DATABASE SCHEMA (MIGRATION 010)
-- Location Schema Enhancement: Code, Name, and Flexible Placement
-- ====================================================================

-- 1. Add code and name columns to locations table
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- 2. Backfill existing location names and codes
UPDATE locations
SET name = COALESCE(description, building)
WHERE name IS NULL;

UPDATE locations
SET code = 'LOC-' || UPPER(SUBSTRING(id::text, 1, 6))
WHERE code IS NULL;

-- 3. Make building column nullable or flexible with default
ALTER TABLE locations
    ALTER COLUMN building DROP NOT NULL;

-- 4. Create index for fast code and name lookups
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
