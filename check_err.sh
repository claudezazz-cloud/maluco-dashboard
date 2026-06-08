#!/bin/bash
sqlite3 /var/lib/docker/volumes/n8n_data/_data/database.sqlite "SELECT workflowData FROM execution_entity ORDER BY startedAt DESC LIMIT 1;" > /opt/zazz/dashboard/last_exec.json
cat /opt/zazz/dashboard/last_exec.json
