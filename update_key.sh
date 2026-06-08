#!/bin/bash
sed -i "s/const API_KEY = .*/const API_KEY = 'REDACTED-ANTHROPIC-KEY';/g" /opt/zazz/dashboard/v3_dump/agent_loop_code.js
python3 /opt/zazz/dashboard/v3_dump/deploy_full.py
