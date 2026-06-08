import sys

with open('/docker/n8n/docker-compose.yml', 'r') as f:
    content = f.read()

content = content.replace('image: docker.n8n.io/n8nio/n8n:2.14.2-debian', 'image: docker.n8n.io/n8nio/n8n')

with open('/docker/n8n/docker-compose.yml', 'w') as f:
    f.write(content)
