#!/bin/bash
docker logs n8n-n8n-1 --tail 50 > /opt/zazz/dashboard/n8n_logs.txt
cat /opt/zazz/dashboard/n8n_logs.txt
