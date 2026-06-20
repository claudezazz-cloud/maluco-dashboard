# Plano de Implementação da Tool "Gerar Carnê"

O script `worker.js` foi testado no VPS com os argumentos `55832` e `Junho,Julho,Agosto,Setembro,Outubro,Novembro` e a execução fluiu perfeitamente! A API `faturar` também já está pronta na Dashboard. Agora só falta integrar a tool no N8N.

## Próximos Passos (Implementação no Agent Loop)

1. **Definir o Schema da Tool no `agent_loop_code.js`**
   Criar a ferramenta `gerar_carne` com o seguinte Schema para a IA:
   - `cliente`: String (Código do cliente, ex: "55832")
   - `meses`: Array de Strings (ex: `["Junho", "Julho"]`)

2. **Criar a Lógica de Chamada (Handler)**
   No `executarTool` dentro do `agent_loop_code.js`, interceptar `gerar_carne` e fazer uma requisição HTTP POST para `${DASH_BASE}/api/faturar` passando o token interno e o `body` com o cliente e meses.
   
3. **Tratamento de Long-Running Task**
   Como a geração no Routerbox pode demorar (ex: 3 minutos para 6 carnês), temos que instruir a IA a não travar a conversa e a enviar uma mensagem de "Aguarde um momento" enquanto o N8N espera a resposta da API (O timeout do node HTTP no N8N não deve estourar antes do script terminar).

4. **Atualizar a N8N e a VPS**
   - Atualizar o script injetando o novo código no `workflow_v2.json`.
   - Enviar por SCP e executar `vps_apply_workflow.py` na VPS para reiniciar o N8N e carregar a nova tool.

5. **Ajuste Fino de System Prompt (Opcional)**
   Garantir que a IA valide ativamente com o cliente se o cliente certo foi encontrado ANTES de engatilhar a tool `gerar_carne` (como na conversa de exemplo: *"Encontrei o cliente Franquelin, posso gerar?"*).

Se o plano estiver de acordo, posso iniciar as alterações no código!
