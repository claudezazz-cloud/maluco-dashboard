#!/bin/bash
echo "--- UPTIME & LOAD ---"
uptime
echo "--- MEMORY ---"
free -m
echo "--- TOP PROCESSES ---"
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%cpu | head -15
echo "--- DOCKER STATS ---"
docker stats --no-stream
