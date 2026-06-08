const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('/var/lib/docker/volumes/n8n_data/_data/database.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  }
});

db.serialize(() => {
  db.get(`SELECT workflowData, data FROM execution_entity WHERE id = 118928`, (err, row) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Found row? " + !!row);
    if(row) {
        console.log("Keys: ", Object.keys(row));
    }
  });
});

db.close();
