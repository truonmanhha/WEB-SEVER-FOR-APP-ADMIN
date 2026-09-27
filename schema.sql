CREATE TABLE IF NOT EXISTS sv_channels (
 id uuid PRIMARY KEY, read_hash text NOT NULL, write_hash text NOT NULL, device_id uuid, created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS sv_messages (
 channel_id uuid NOT NULL REFERENCES sv_channels(id) ON DELETE CASCADE,
 id uuid NOT NULL, created_at bigint NOT NULL, expires_at bigint NOT NULL,
 digest text NOT NULL, envelope jsonb NOT NULL, acked boolean NOT NULL DEFAULT false,
 PRIMARY KEY(channel_id,id)
);
CREATE INDEX IF NOT EXISTS sv_messages_pending ON sv_messages(channel_id,created_at,id) WHERE acked=false;
CREATE INDEX IF NOT EXISTS sv_messages_expiry ON sv_messages(expires_at);
CREATE TABLE IF NOT EXISTS sv_sessions (token_hash text PRIMARY KEY, expires_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS sv_login_limits (key text PRIMARY KEY, attempts integer NOT NULL, reset_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS sv_web_config (id integer PRIMARY KEY CHECK(id=1), wrapped jsonb NOT NULL);

