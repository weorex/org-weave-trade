#!/usr/bin/env bash
# Load JSON snapshots (exported from the Lovable Cloud DB) into the local database.
# Usage: local-db/load-data.sh [database name or connection URI] [tables to skip, comma-separated]
#   local-db/load-data.sh                                   -> local org_weave_trade
#   local-db/load-data.sh "$DATABASE_URL" auth.users,storage.buckets  -> Supabase (users created via admin API)
set -euo pipefail
DB="${1:-org_weave_trade}"
SKIP="${2:-}"
DIR="$(cd "$(dirname "$0")" && pwd)"
for f in "$DIR"/data/*.json; do
  echo "Loading $(basename "$f")"
  psql -h localhost -d "$DB" -v ON_ERROR_STOP=1 -q -v skip="$SKIP" -v content="$(cat "$f")" <<'SQL'
SET session_replication_role = replica;
CREATE TEMP TABLE _snapshot AS SELECT :'content'::jsonb - string_to_array(:'skip', ',') AS data;
DO $$
DECLARE t record; cols text;
BEGIN
  FOR t IN SELECT key, value FROM _snapshot, jsonb_each(data) WHERE jsonb_typeof(value) = 'array' LOOP
    SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position) INTO cols
    FROM information_schema.columns
    WHERE table_schema = split_part(t.key, '.', 1) AND table_name = split_part(t.key, '.', 2)
      AND column_name IN (SELECT jsonb_object_keys(t.value->0));
    EXECUTE format('INSERT INTO %s (%s) SELECT %s FROM jsonb_populate_recordset(NULL::%s, $1) ON CONFLICT DO NOTHING',
                   t.key, cols, cols, t.key) USING t.value;
  END LOOP;
END $$;
SQL
done
echo "Done."
