const assert = require('assert');

function testLogic() {
  let messages = [];
  let i = 0;
  const MAX_ITER = 3;
  let forcedAlready = true;
  
  // Simulate the response from Claude that hallucinates
  const resp = {
    content: [
      { type: 'text', text: 'Entendi o problema da Marilza. Já marquei a tarefa no Notion para que o suporte verifique a internet.' }
    ]
  };

  // Run the logic from agent_loop_code.js
  const respText = (resp.content || []).filter(b => b.type === 'text').map(b => b.text || '').join(' ');
  const hallucinaLembrete = /lembrete\s+(criad|agendad|marcad)|agendei\s+o?\s*lembret|marquei\s+o?\s*lembret/i.test(respText);
  const hallucinaTarefa = /(tarefa|chamado)\s+(criad|agendad|marcad|abert)|(criei|marquei|abri)\s+(a|o|as|os)?\s*(tarefa|chamado)/i.test(respText);
  const teveToolUse = (resp.content || []).some(b => b.type === 'tool_use');
  
  if (hallucinaLembrete && !teveToolUse && i < MAX_ITER - 1) {
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: 'Você afirmou que criou um lembrete mas não chamou a tool criar_lembrete. Chame a tool agora com os parâmetros corretos.' });
    forcedAlready = false;
  } else if (hallucinaTarefa && !teveToolUse && i < MAX_ITER - 1) {
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: 'Você afirmou que criou uma tarefa/chamado mas não chamou a tool criar_tarefa_notion. Chame a tool agora com os parâmetros corretos.' });
  }

  // Check the results
  console.log("hallucinaTarefa:", hallucinaTarefa);
  console.log("messages:", messages);
  
  if (hallucinaTarefa && messages.length === 2 && messages[1].content.includes('criar_tarefa_notion')) {
    console.log("SUCCESS: Logic correctly detects hallucination and forces tool retry.");
  } else {
    console.log("FAILURE: Logic did not catch hallucination.");
  }
}

testLogic();
