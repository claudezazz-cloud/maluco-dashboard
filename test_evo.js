const ExcelJS = require('exceljs');

async function run() {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Test');
    sheet.addRow(['Hello', 'World']);
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = buffer.toString('base64');
    
    // Test the evolution API
    const chatId = '554384924456-1616013394@g.us'; // O grupo que ele testou
    // Or I can send to the user's direct chat? The screenshot has a group?
    
    // Let me log the base64 prefix
    console.log("Sending...");
    const res = await fetch('https://lanlunar-evolution.cloudfy.live/message/sendMedia/ZazzClaude', {
      method: 'POST',
      headers: {
        'apikey': 'REDACTED-EVO-KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: chatId,
        mediatype: 'document',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: 'teste.xlsx',
        caption: 'Teste de planilha',
        media: base64
      })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch(e) {
    console.error(e);
  }
}
run();
