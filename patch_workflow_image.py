import json

with open('workflow_v2.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

# 1. Update Monta Prompt Relatório
for node in wf['nodes']:
    if node['name'] == 'Monta Prompt Relatório':
        jsCode = node['parameters']['jsCode']
        
        new_instruction = r"""
INSTRUÇÃO VITAL E OBRIGATÓRIA:
O seu formato de saída DEVE SER ESTRITAMENTE UM JSON VÁLIDO contendo os dados do relatório. NÃO retorne nenhum texto antes ou depois do JSON. Não use blocos de código (```json). Apenas o JSON cru.
A estrutura OBRIGATÓRIA do JSON é:
{
  "data": "${dia}/${mes}/${ano}",
  "total": ${totalMsgs},
  "concluidos": ${resolucoes.length},
  "pendentes": ${solicitacoes.length},
  "categorias": [
    {
      "nome": "NOME DA CATEGORIA",
      "chamados": [
        {
          "id": "12345",
          "cliente": "Nome do Cliente",
          "dias": 1,
          "alert": "⚠️" 
        }
      ]
    }
  ]
}
No campo "alert", coloque "⚠️" para chamados > 7 dias, "⚠️⚠️" para > 30 dias, e vazio para recentes.
O id deve ser a identificação da OS ou do cliente. Formate "cliente" removendo nomes muito longos.
A categoria deve ser algo como "PERCA DE EQUIPAMENTO", "RETENÇÃO SPC", "MODIFICAÇÃO", etc. Agrupe os chamados corretamente.
"""
        
        old_prompt = r"""ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

*📋 RELATÓRIO ${periodoLabel}*
_${dia}/${mes}/${ano}_

*🟢 SERVIÇOS CONCLUÍDOS:*
Liste TODOS os serviços que foram marcados como resolvido/concluído/pronto/feito.
Formato: - [horário] _Cliente/Situação_ — resolvido por _Técnico_ ✅

*🔴 SERVIÇOS PENDENTES:*
Liste TODOS os serviços solicitados que NÃO tiveram resposta de resolução.
Formato: - [horário] _Cliente/Situação_ — solicitado por _Pessoa_ ⚠️

*📊 RESUMO GERAL:*
- Total de atendimentos: X
- Concluídos: X
- Pendentes: X
- Taxa de resolução: X%

*💡 DESTAQUES E OBSERVAÇÕES:*
- Situações críticas ou urgentes
- Padrões observados (ex: muitos chamados da mesma região)
- Sugestões baseadas nos POPs da empresa
${reportType !== 'diario' ? '\n*📈 TENDÊNCIAS DO PERÍODO:*\n- Padrões recorrentes\n- Comparação entre dias\n- Áreas com mais demanda\n' : ''}
FORMATAÇÃO: WhatsApp (*negrito*, _itálico_, emojis). PROIBIDO: **, ##, ###, blocos de código.
Seja COMPLETO — liste TODOS os atendimentos, não resuma em \"vários serviços\". O objetivo é que ninguém fique para trás."""
        
        if old_prompt in jsCode:
            jsCode = jsCode.replace(old_prompt, new_instruction)
            jsCode = jsCode.replace('Gere o relatório completo ${periodoLabel.toLowerCase()} por favor! Liste TODOS os atendimentos sem exceção.', 'Gere o relatório completo ${periodoLabel.toLowerCase()} por favor retornando SOMENTE O JSON VÁLIDO. Liste TODOS os atendimentos sem exceção agrupados por categoria.')
            node['parameters']['jsCode'] = jsCode
            print("Patched Monta Prompt Relatório!")

# 2. Update Parse Resposta
for node in wf['nodes']:
    if node['name'] == 'Parse Resposta':
        jsCode = node['parameters']['jsCode']
        
        parse_addition = """
let isImageReport = false;
let reportJson = null;

try {
  let cleanedText = fullText.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
  }
  if (cleanedText.startsWith('{') && cleanedText.includes('"categorias"')) {
    reportJson = JSON.parse(cleanedText);
    isImageReport = true;
    whatsappMessage = "Bom dia, equipe Zazz! 🍀\\nSegue o resumo das nossas operações e atendimentos.";
  }
} catch(e) {}
"""
        if "let notionBody = null;" in jsCode and "isImageReport" not in jsCode:
            jsCode = jsCode.replace("let notionBody = null;", "let notionBody = null;\n" + parse_addition)
            ret_string = "tokensOutput: tokensOutput"
            new_ret_string = "tokensOutput: tokensOutput,\n    isImageReport: isImageReport,\n    reportJson: reportJson"
            jsCode = jsCode.replace(ret_string, new_ret_string)
            node['parameters']['jsCode'] = jsCode
            print("Patched Parse Resposta!")

# 3. Insert new nodes
new_nodes = [
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": True,
            "leftValue": "",
            "typeValidation": "loose",
            "version": 3
          },
          "conditions": [
            {
              "id": "abc-if-report",
              "leftValue": "={{ $json.isImageReport }}",
              "rightValue": True,
              "operator": {
                "type": "boolean",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "looseTypeValidation": True,
        "options": {}
      },
      "id": "if-image-report-node",
      "name": "É Relatório Imagem?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        15000,
        8736
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://dashboard.srv1537041.hstgr.cloud/api/report-image",
        "sendHeaders": True,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify($json.reportJson) }}",
        "options": {
          "response": {
            "response": {
              "responseFormat": "file",
              "outputPropertyName": "data"
            }
          }
        }
      },
      "id": "generate-image-api-node",
      "name": "Gera Imagem API",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.3,
      "position": [
        15200,
        8736
      ],
      "continueOnFail": False
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://lanlunar-evolution.cloudfy.live/message/sendMedia/ZazzClaude",
        "sendHeaders": True,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "REDACTED-EVO-KEY"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ number: $('Parse Resposta').first().json.chatId, mediatype: 'image', mimetype: 'image/png', caption: $('Parse Resposta').first().json.message, media: $binary.data.data }) }}",
        "options": {
          "timeout": 30000
        }
      },
      "id": "envia-imagem-whatsapp-node",
      "name": "Envia Imagem WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.3,
      "position": [
        15400,
        8736
      ],
      "continueOnFail": True,
      "onError": "continueRegularOutput"
    }
]

node_names = [n['name'] for n in wf['nodes']]
for n in new_nodes:
    if n['name'] not in node_names:
        wf['nodes'].append(n)
        print(f"Added {n['name']}")

conn = wf['connections']
parse_resp_conns = conn.get('Parse Resposta', {}).get('main', [[]])
if parse_resp_conns and len(parse_resp_conns[0]) > 0:
    original_connections = parse_resp_conns[0].copy()
    
    conn['Parse Resposta']['main'] = [[
        {
            "node": "É Relatório Imagem?",
            "type": "main",
            "index": 0
        }
    ]]
    
    conn['É Relatório Imagem?'] = {
        "main": [
            [
                {
                    "node": "Gera Imagem API",
                    "type": "main",
                    "index": 0
                }
            ],
            original_connections
        ]
    }
    
    conn['Gera Imagem API'] = {
        "main": [
            [
                {
                    "node": "Envia Imagem WhatsApp",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    }
    print("Patched connections!")

with open('workflow_v2.json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)
print("Done!")
