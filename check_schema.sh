#!/bin/bash
sqlite3 /var/lib/docker/volumes/n8n_data/_data/database.sqlite "PRAGMA table_info(execution_entity);"
