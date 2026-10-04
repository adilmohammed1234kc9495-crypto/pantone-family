-- ====================================================================
-- PANTONE FIXED ASSET MANAGEMENT SYSTEM - MIGRATION 002
-- AUTHENTICATION SESSIONS, REFRESH TOKENS & RATE LIMITING
-- ====================================================================

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(user_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key VARCHAR(255) PRIMARY KEY,
    failed_attempts INT NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_locked ON auth_rate_limits(key, locked_until);