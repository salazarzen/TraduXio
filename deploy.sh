#!/bin/bash

DATABASE=${1-http://localhost:5984/traduxio}
log=deploy.log

echo Deploying on $DATABASE
# Test couchapp's own status: a command substitution in between would reset $?
# and make a failed push look like a success.
if couchapp push couchdb $DATABASE 2> $log; then
  DB=$(tail -1 $log)
  echo Deployed on $DB
  echo Reindexing $DB/works
  curl -s $DB/works -o /dev/null -w "Finished in %{time_total} seconds\n"
else
  echo Failed
  cat $log
  exit 1
fi
