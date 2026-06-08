#!/bin/bash
docker stop n8n-n8n-1
python3 /opt/zazz/dashboard/v3_dump/fix_n8n.py
docker start n8n-n8n-1
echo "Waiting for n8n to start..."
sleep 15
docker exec n8n-n8n-1 n8n update:workflow --id=Pj5SdaxFh9H9EIX4 --active=true
docker restart n8n-n8n-1
