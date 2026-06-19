# Pulso do Brasil — frontend for Supabase backend

Este repositório contém a interface estática do Pulso do Brasil. O backend é esperado ser um projeto Supabase com as rotinas SQL fornecidas no arquivo `pulso-sql.txt` (cole no SQL Editor do Supabase e execute).

Importante (setup do Supabase)
1. Crie um projeto Supabase.
2. Abra o SQL Editor no painel do projeto e cole TODO o SQL fornecido pelo backend (o SQL que você já tem, com criação de tabelas, funções e políticas). Execute.
3. Em Settings → API copie: Project URL (usar no front) e anon key (ANON KEY) — cole no topo do `index.html` nas variáveis `window.SUPABASE_URL` e `window.SUPABASE_ANON_KEY`.

Arquivos atualizados
- `index.html` — interface Pulso do Brasil (botões de emoção, feed ao vivo, atlas diário).
- `script.js` — lógica que usa Supabase (RPC `cast_beat`, RPC `get_live`, leitura de `daily_atlas`).
- `styles.css` — mantém seu CSS atual (ajuste se quiser melhorar o visual).

Como testar localmente
- Sirva o diretório com um servidor estático (Python 3):

```bash
python -m http.server 8000
# abra http://localhost:8000
```

Publicar
- Você pode publicar via GitHub Pages: Repository → Settings → Pages → Source: Deploy from branch `main` → folder `/`.

Segurança
- Não coloque chaves (anon key) em locais públicos a longo prazo. A ANON key do Supabase pode ser usada em clientes, mas qualquer segredo de serviço (SERVICE_ROLE) não deve ser exposto.
- Para maior segurança, mova endpoints sensíveis para funções server-side.

Quer que eu também rode o SQL de backend no seu projeto Supabase (requererá que você me forneça Project URL e Service Role key — NÃO RECOMENDADO via chat)?

---
Pulso SQL (cole no SQL Editor do Supabase):

```sql
-- Cole aqui o SQL que você me forneceu (pulso-do-brasil setup)
-- (omiti o conteúdo por brevidade; se quiser, eu insiro o SQL completo neste README ou crio um arquivo separado pulso-sql.sql)
```
