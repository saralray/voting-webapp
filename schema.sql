CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE RESTRICT,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_name_unique_idx ON users (name);
CREATE UNIQUE INDEX IF NOT EXISTS votes_user_id_unique_idx ON votes (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS admins_email_unique_idx ON admins (email);
