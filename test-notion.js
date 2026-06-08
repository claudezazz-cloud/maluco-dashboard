const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const NOTION_TOKEN = envFile.split('\n').find(l => l.startsWith('NOTION_TOKEN=')).split('=')[1].trim();
const NOTION_DB = 'd54e5911e8af43dfaed8f2893e59f6ef';

const body = {
  filter: { 
    and: [
      { property: 'status', select: { does_not_equal: 'Ok' } },
      { property: 'status', select: { does_not_equal: 'Cancelado' } },
      { property: 'status', select: { does_not_equal: 'Cancelados' } }
    ]
  },
  page_size: 5,
};

fetch(`https://api.notion.com/v1/databases/${NOTION_DB}/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
