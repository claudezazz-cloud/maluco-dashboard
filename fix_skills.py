import json, sys

node_verifica = "Verifica Men\u00e7\u00e3o"

with open('workflow_v2.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

for node in wf['nodes']:
    if node.get('name') == 'Monta Prompt':
        code = node['parameters']['jsCode']

        start_marker = "let skillContext = '';"
        end_marker = "} catch(e) {}"

        idx_start = code.find(start_marker)
        idx_end = code.find(end_marker, idx_start)
        idx_end_full = idx_end + len(end_marker)

        if idx_start == -1 or idx_end == -1:
            print("ERROR: markers not found")
            sys.exit(1)

        # Inside JS string literals we use \n as 2-char escape sequence.
        # In Python source that means \\n (so the JSON stores \\n which JS reads as \n).
        v = node_verifica  # "Verifica Menção"
        new_block = (
            "let skillContext = '';\n"
            "try {\n"
            "  const skillName = $('" + v + "').first().json?.skillName || null;\n"
            "  if (skillName) {\n"
            "    const skills = $('Busca Skills').all().map(s => s.json).filter(s => s.nome);\n"
            "    const skill = skills.find(s => s.nome === skillName);\n"
            "    if (skill?.prompt_base) {\n"
            "      const skillArgs = $('" + v + "').first().json?.skillArgs || '';\n"
            "      skillContext = '\\n\\n[SKILL] SKILL ATIVADA: ' + skillName + '\\n' + skill.prompt_base;\n"
            "      if (skillArgs) skillContext += '\\n\\nParametros: ' + skillArgs;\n"
            "    }\n"
            "  }\n"
            "} catch(e) {}"
        )

        code = code[:idx_start] + new_block + code[idx_end_full:]
        node['parameters']['jsCode'] = code
        print("Patched Monta Prompt skillContext block.")

        # Verify no literal newlines inside string literals on the skillContext lines
        for line in new_block.split('\n'):
            if 'skillContext' in line and ('=' in line or '+=' in line):
                has_bad = False
                in_str = False
                for ch in line:
                    if ch == "'":
                        in_str = not in_str
                    elif in_str and ord(ch) == 10:
                        has_bad = True
                if has_bad:
                    print("  WARNING: literal newline inside string:", repr(line))
                else:
                    print("  OK:", repr(line))
        break

with open('workflow_v2.json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("Done.")
