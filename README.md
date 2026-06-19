# Pulso - Weather Dashboard

Pequeno painel de tempo que usa a API pública do OpenWeatherMap.

## Arquivos
- `index.html` — estrutura da página (já no repositório).
- `styles.css` — estilos.
- `script.js` — lógica para buscar e renderizar dados do OpenWeatherMap.

## Como obter a API Key
1. Vá em https://openweathermap.org/ e crie uma conta (gratuita).
2. Acesse "API keys" no painel e crie uma chave.
3. Substitua `YOUR_API_KEY` em `script.js` pela sua chave.

> Observação: sites estáticos expõem a chave ao cliente — para produção, prefira um backend/proxy (função serverless ou Supabase Edge Function) para esconder a chave.

## Testar localmente
Servir via um servidor estático (não funcione abrindo o arquivo diretamente por arquivo system path):

- Python 3:
  - `python -m http.server 8000`
  - Abra `http://localhost:8000`
- Ou:
  - `npm i -g serve` e `serve .`

## Como enviar ao GitHub (via web)
1. Vá no repositório `januleite/pulso`.
2. Clique em "Add file" → "Create new file".
3. Cole o conteúdo do `script.js`, salve como `script.js` e faça commit.
4. Repita para `README.md` (ou crie localmente e faça push pelo git).

## Como enviar ao GitHub (via git)
```bash
git clone https://github.com/januleite/pulso.git
cd pulso
# criar arquivos locais (index.html já existe)
# salvar script.js e README.md
git add script.js README.md
git commit -m "Add weather dashboard script and README"
git push origin main
```

## Publicar com GitHub Pages
1. No repositório → Settings → Pages.
2. Em "Source": selecione "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Salve. Em ~1 minuto a URL será `https://januleite.github.io/pulso`.

## Configurar Supabase (se for usar autenticação/redirects)
No painel do Supabase (Project → Settings → Auth ou Authentication → Settings), adicione:

- Redirect URL(s):
  - `https://januleite.github.io/pulso`
  - `http://localhost:8000` (opcional, para testes locais)
- Site URL / Allowed origins:
  - `https://januleite.github.io`

## Melhorias sugeridas
- Proteger a API key: mover chamadas para servidor (Supabase Edge Function, Netlify Function, etc).
- Cache local do resultado para evitar limites.
- Adicionar ícones/badges, tema claro/escuro, ou seleção de unidades (°C/°F).
