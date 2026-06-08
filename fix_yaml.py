import sys

with open('/docker/n8n/docker-compose.yml', 'r') as f:
    lines = f.readlines()
new_lines = []
for line in lines:
    if 'N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS' in line:
        new_lines.append('      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false\n')
    elif 'N8N_RUNNERS_MAX_CONCURRENCY' in line:
        pass
    elif 'N8N_RUNNERS_ENABLED' in line:
        pass
    else:
        new_lines.append(line)
with open('/docker/n8n/docker-compose.yml', 'w') as f:
    f.writelines(new_lines)
