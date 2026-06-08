#!/bin/bash
sqlite3 /var/lib/docker/volumes/n8n_data/_data/database.sqlite "SELECT id, status, startedAt, stoppedAt FROM execution_entity ORDER BY startedAt DESC LIMIT 10;"
