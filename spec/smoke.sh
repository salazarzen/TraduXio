#!/bin/bash
#
# Differential smoke test for the 24 rewrite rules in couchdb/rewrites.json.
#
# Probes every rule against one or two CouchDB servers and prints the HTTP
# status of each. With two servers it diffs them, which is the whole point: for
# the 1.7.1 -> 3.5.3 migration the absolute status of a rule matters far less
# than whether it CHANGED.
#
# Read-only by design: it only ever issues GET. Rules whose target is an
# _update handler are probed too, because a GET against one returns a
# deterministic status without writing anything, and a change in that status is
# exactly what we want to notice.
#
# Usage:
#   spec/smoke.sh <url>            print the table for one server
#   spec/smoke.sh <url-a> <url-b>  compare two servers; exit 1 on any difference
#
# <url> is a full database URL, with credentials if the server needs them:
#   spec/smoke.sh http://localhost:5984/traduxio \
#                 http://admin:changeme@localhost:5985/traduxio

TIMEOUT=${SMOKE_TIMEOUT:-8}

A=$1
B=$2

if [ -z "$A" ]; then
  echo "usage: $0 <url> [<url-to-compare>]" >&2
  exit 2
fi

# A real document id exercises the templating and hexapla paths; without one
# the probes still compare fine, they just cover less.
discover_id() {
  curl -s -m "$TIMEOUT" "$1/_design/traduxio/_view/works?limit=1" 2>/dev/null \
    | tr ',' '\n' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
}

probe() {
  local code rc
  code=$(curl -s -o /dev/null -m "$TIMEOUT" -w '%{http_code}' \
           "$1/_design/traduxio/_rewrite/$2" 2>/dev/null)
  rc=$?
  if [ "$rc" -eq 28 ]; then
    echo "TIMEOUT"
  elif [ "$rc" -ne 0 ]; then
    echo "ERR$rc"
  else
    echo "$code"
  fi
}

# rule label <TAB> probe path relative to _rewrite/ . __ID__ is substituted
# with a discovered document id. Order follows couchdb/rewrites.json.
RULES=$(cat <<'TABLE'
works/concordance	works/concordance?query=lamp
languages	languages
works/version/:id	works/version/__ID__
works/copyright	works/copyright
works	works
myworks	myworks
shared/*	shared/css/traduxio.css
robots.txt	robots.txt
works/:id	works/__ID__
works/work (POST)	works/work
works/work/:id	works/work/__ID__
works/work/:id/:version	works/work/__ID__/v1
works/license/:id/:version	works/license/__ID__/v1
works/:id/print/:version	works/__ID__/print/v1
glossary/:id (POST)	glossary/__ID__
works/work/:id/glossary/...	works/work/__ID__/glossary/en/hello/fr
works/:id/presence	works/__ID__/presence
password_request (PUT)	password_request
password_request/:id	password_request/nosuchrequest
'' (welcome)	
works/:id/chat (POST)	works/__ID__/chat
works/:id/activity	works/__ID__/activity
users/search/:search	users/search/a
works/:id/changes/:seq	works/__ID__/changes/0
TABLE
)

ID_A=$(discover_id "$A"); ID_A=${ID_A:-nonexistent}
echo "A: $A   (doc id: $ID_A)"
if [ -n "$B" ]; then
  ID_B=$(discover_id "$B"); ID_B=${ID_B:-nonexistent}
  echo "B: $B   (doc id: $ID_B)"
fi
echo

diffs=0
if [ -n "$B" ]; then
  printf '%-32s %-9s %-9s %s\n' RULE A B ""
  printf '%-32s %-9s %-9s %s\n' "--------------------------------" "-------" "-------" "----"
else
  printf '%-32s %-9s\n' RULE STATUS
  printf '%-32s %-9s\n' "--------------------------------" "-------"
fi

while IFS=$'\t' read -r label path; do
  [ -z "$label" ] && continue
  pa=${path//__ID__/$ID_A}
  ca=$(probe "$A" "$pa")
  if [ -n "$B" ]; then
    pb=${path//__ID__/$ID_B}
    cb=$(probe "$B" "$pb")
    if [ "$ca" = "$cb" ]; then
      mark=""
    else
      mark="<-- DIFF"
      diffs=$((diffs + 1))
    fi
    printf '%-32s %-9s %-9s %s\n' "$label" "$ca" "$cb" "$mark"
  else
    printf '%-32s %-9s\n' "$label" "$ca"
  fi
done <<< "$RULES"

if [ -n "$B" ]; then
  echo
  echo "$diffs rule(s) differ"
  [ "$diffs" -gt 0 ] && exit 1
fi
exit 0
