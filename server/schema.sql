-- Blood Donation Database Schema
-- PostgreSQL Schema for donors and stats tables

-- Create donors table
CREATE TABLE IF NOT EXISTS donors (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    age INTEGER NOT NULL CHECK (age >= 18 AND age <= 100),
    year VARCHAR(20) NOT NULL CHECK (year IN ('FY', 'SY', 'TY', 'Final Year')),
    donated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_name CHECK (LENGTH(TRIM(full_name)) >= 2)
);

-- Create index on donated_at for faster queries
CREATE INDEX IF NOT EXISTS idx_donors_donated_at ON donors(donated_at DESC);

-- Create index on blood_group for analytics
CREATE INDEX IF NOT EXISTS idx_donors_blood_group ON donors(blood_group);

-- Create stats table
CREATE TABLE IF NOT EXISTS stats (
    identifier VARCHAR(50) PRIMARY KEY,
    total_blood_units INTEGER DEFAULT 0 CHECK (total_blood_units >= 0),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial stats row
INSERT INTO stats (identifier, total_blood_units)
VALUES ('global', 0)
ON CONFLICT (identifier) DO NOTHING;

-- Grant necessary permissions (adjust username if needed)
-- GRANT ALL PRIVILEGES ON TABLE donors TO your_db_user;
-- GRANT ALL PRIVILEGES ON TABLE stats TO your_db_user;
-- GRANT USAGE, SELECT ON SEQUENCE donors_id_seq TO your_db_user;
