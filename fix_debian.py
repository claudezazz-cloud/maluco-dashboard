import sys

with open('/docker/n8n/docker-compose.yml', 'r') as f:
    lines = f.readlines()
new_lines = []
for line in lines:
    if 'image: docker.n8n.io/n8nio/n8n' in line and 'chatwoot' not in line:
        new_lines.append('    image: docker.n8n.io/n8nio/n8n:2.14.2-debian\n')
    elif 'N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS' in line:
        new_lines.append('      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false\n')
    elif 'N8N_RUNNERS_TASK_REQUEST_TIMEOUT' in line:
        pass
    elif 'N8N_HOST' in line:
        new_lines.append(line)
        new_lines.append('      - N8N_RUNNERS_TASK_REQUEST_TIMEOUT=300\n')
    else:
        new_lines.append(line)
        
with open('/docker/n8n/docker-compose.yml', 'w') as f:
    f.writelines(new_lines)
