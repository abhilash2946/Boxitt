-- =============================================================================
-- MIGRATION 000: Extensions
-- Description: Enabling core database features.
-- =============================================================================

-- Enable PostGIS for geospatial lookups (e.g., finding nearby users)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enable uuid-ossp for random UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
