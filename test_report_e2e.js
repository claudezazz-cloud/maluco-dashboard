const http = require('http');

const payload = JSON.stringify({
  data: "03/06/2026",
  total: 3,
  concluidos: 1,
  pendentes: 2,
  categorias: [{
    nome: "Internet",
    chamados: [
      { id: "001", cliente: "Teste A", dias: 5 },
      { id: "002", cliente: "Teste B", dias: 20 }
    ]
  }]
});

const opts = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/report-image',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(opts, res => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    console.log('IMAGE STATUS:', res.statusCode);
    console.log('IMAGE SIZE:', buf.length, 'bytes');
    
    if (res.statusCode === 200) {
      const b64 = buf.toString('base64');
      
      // Evolution API wants just base64, no data: prefix
      const evoPayload = JSON.stringify({
        number: '120363409735124488@g.us',
        mediatype: 'image',
        mimetype: 'image/png',
        caption: 'Teste de relatório em imagem 📊',
        media: b64
      });
      
      const evoOpts = {
        hostname: 'lanlunar-evolution.cloudfy.live',
        path: '/message/sendMedia/ZazzClaude',
        method: 'POST',
        headers: {
          'apikey': 'REDACTED-EVO-KEY',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(evoPayload)
        }
      };
      
      const evoReq = require('https').request(evoOpts, evoRes => {
        let body = '';
        evoRes.on('data', c => body += c);
        evoRes.on('end', () => {
          console.log('EVO STATUS:', evoRes.statusCode);
          console.log('EVO RESPONSE:', body.substring(0, 400));
        });
      });
      evoReq.on('error', e => console.log('EVO ERROR:', e.message));
      evoReq.write(evoPayload);
      evoReq.end();
    }
  });
});

req.on('error', e => console.log('REQUEST ERROR:', e.message));
req.write(payload);
req.end();
