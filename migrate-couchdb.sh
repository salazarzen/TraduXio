#!/bin/bash
#
# Replicate a TraduXio database from one CouchDB server to another, then verify
# the result. There is no in-place upgrade path from CouchDB 1.x: 2.0 changed
# the file format and made the server clustered, so moving to 3.x means
# replicating between two live servers.
#
# Design documents are deliberately EXCLUDED. The couchapp is build output, not
# data; replicating it would drag 1.x revision history into the new server and
# collide with a clean `couchapp push`. Push the design doc separately
# (./deploy.sh, or the couchapp container).
#
# Usage:
#   ./migrate-couchdb.sh <source> <target> [<endpoint>]
#
#   <source>    source database URL, AS THE ENDPOINT SERVER RESOLVES IT
#   <target>    target database URL with admin credentials, likewise
#   <endpoint>  the CouchDB that runs the job, as seen from HERE.
#               Defaults to <target> minus its database name.
#
# Both URLs are passed to CouchDB, not fetched by this script, so they must
# resolve from the endpoint server. When that differs from where the script
# runs, give the script its own view of the two databases for verification:
#
#   VERIFY_SOURCE=... VERIFY_TARGET=... ./migrate-couchdb.sh ...
#
# Example. compose.yml runs 3.5.3 only, so to migrate you bring the old 1.7.1
# server up temporarily on its existing data, on the same docker network and a
# spare port (5986 below), and pull from it:
#
#   git show <old-rev>:compose.yml > compose.couchdb1.yml   # 1.7.1 from history
#   # ...start it as `traduxio-1x` on the compose network, publishing 5986...
#
#   VERIFY_SOURCE=http://localhost:5986/traduxio
#   VERIFY_TARGET=http://admin:changeme@localhost:5984/traduxio
#   ./migrate-couchdb.sh http://traduxio-1x:5984/traduxio
#                        http://admin:changeme@couchdb:5984/traduxio
#                        http://admin:changeme@localhost:5984
#
# (all on one line, or with shell continuations). Then shut 1.7.1 down for good.

set -u

SOURCE=${1-}
TARGET=${2-}
ENDPOINT=${3-${2%/*}}

VERIFY_SOURCE=${VERIFY_SOURCE-$SOURCE}
VERIFY_TARGET=${VERIFY_TARGET-$TARGET}

if [ -z "$SOURCE" ] || [ -z "$TARGET" ]; then
  echo "usage: $0 <source> <target> [<endpoint>]" >&2
  exit 2
fi

# "<id> <rev>" per non-design document. Replication preserves revisions, so
# comparing these two sets verifies content, not merely document count.
list_docs() {
  curl -s -m 120 "$1/_all_docs" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except ValueError:
    sys.exit("could not parse _all_docs")
for r in d.get("rows", []):
    if not r["id"].startswith("_design/"):
        print(r["id"], r["value"]["rev"])
' | sort
}

doc_ids_json() {
  curl -s -m 120 "$1/_all_docs" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print(json.dumps([r["id"] for r in d.get("rows", [])
                  if not r["id"].startswith("_design/")]))
'
}

echo "source  : $SOURCE"
echo "target  : $TARGET"
echo "endpoint: $ENDPOINT"
echo

ids=$(doc_ids_json "$VERIFY_SOURCE") || exit 1
n=$(printf '%s' "$ids" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
echo "== $n non-design document(s) to replicate =="
if [ "$n" -eq 0 ]; then
  echo "nothing to do"
  exit 0
fi

echo "== replicating =="
resp=$(curl -s -m 600 -X POST "$ENDPOINT/_replicate" \
  -H "Content-Type: application/json" \
  -d "{\"source\":\"$SOURCE\",\"target\":\"$TARGET\",\"doc_ids\":$ids}")

printf '%s\n' "$resp" | head -c 1500; echo

case "$resp" in
  *'"ok":true'*) ;;
  *) echo "REPLICATION FAILED" >&2; exit 1 ;;
esac

echo
echo "== verifying =="
src=$(list_docs "$VERIFY_SOURCE")
tgt=$(list_docs "$VERIFY_TARGET")

if [ "$src" = "$tgt" ]; then
  echo "OK: $(printf '%s\n' "$src" | grep -c .) document(s) match by id and revision"
  exit 0
fi

echo "MISMATCH between source and target:" >&2
diff <(printf '%s\n' "$src") <(printf '%s\n' "$tgt") >&2
exit 1
