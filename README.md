# Nexo

Assistente pessoal instalável (PWA): afazeres com lembretes, vendas diárias, gastos por categoria e leitura de comprovantes (Pix, notinha, nota fiscal). Os dados ficam na Supabase e sincronizam entre PC e celular.

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | O app inteiro |
| `config.js` | Endereço e chave pública da Supabase, e-mail do usuário |
| `sw.js` | Funciona offline, recebe push e comprovantes compartilhados |
| `manifest.webmanifest` | Instalação no celular e menu Compartilhar |
| `supabase/01-tabelas.sql` | Cria as tabelas e a segurança |
| `supabase/02-agendamento.sql` | Faz o servidor de avisos rodar a cada minuto |
| `supabase/functions/send-reminders/index.ts` | Servidor de avisos (envia as notificações) |

## Configuração (uma vez só)

### 1. Projeto na Supabase
1. Crie uma conta em **supabase.com** → **New project**. Escolha a região **South America (São Paulo)**. Anote a senha do banco (não é a senha do app).
2. Em **SQL Editor** → **New query**, cole o conteúdo de `supabase/01-tabelas.sql` e clique **Run**.

### 2. Seu usuário (login só com senha)
1. **Authentication → Users → Add user → Create new user**.
2. Coloque seu e-mail e a senha que você vai usar no app. Marque **Auto Confirm User**.
3. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up**. Assim ninguém mais cria conta no seu app.

### 3. Servidor de avisos
1. **Edge Functions → Deploy a new function → Via Editor**. Nome: `send-reminders`.
2. Apague o código de exemplo, cole o conteúdo de `supabase/functions/send-reminders/index.ts` e clique **Deploy**.
3. Na função, abra **Details** e **desligue "Enforce JWT verification"** (Verify JWT). A proteção é feita pelo `CRON_SECRET`.
4. **Edge Functions → Secrets**: adicione os 4 valores do arquivo `segredos.txt` (enviado separado, fora do GitHub).
5. Em `supabase/02-agendamento.sql`, troque `SEU-PROJETO` e `COLE-AQUI-O-CRON_SECRET`. Cole no **SQL Editor** e clique **Run**.

### 4. Ligar o app na Supabase
Em **Project Settings → API** copie a **Project URL** e a chave **anon public** (ou *publishable*). Coloque em `config.js` junto com o e-mail do passo 2 e salve no GitHub. A Vercel publica sozinha.

### 5. Vercel
**vercel.com → Add New → Project** → importe o repositório `nexo` → **Deploy**. Não precisa mudar nenhuma configuração (é um site estático).

## Usando

- Abra o endereço da Vercel, digite a senha e pronto. No celular: **Instalar app** (Android) ou **Adicionar à Tela de Início** (iPhone).
- Toque em **Ativar avisos** em cada aparelho que deve receber notificações.
- A bolinha no topo mostra a sincronização: verde = sincronizado, azul = enviando, amarelo = sem internet (os dados sobem quando voltar), vermelho = erro.

## Avisos
- O servidor confere a cada minuto e manda push para todos os aparelhos com avisos ativados, mesmo com o app fechado.
- iPhone: precisa de iOS 16.4+ e do app instalado na Tela de Início.

## Compartilhar comprovante do banco
Android, com o app instalado: no banco, **Compartilhar → Nexo**. O gasto é registrado na hora. No iPhone, salve a imagem e use **Enviar arquivo ou print** dentro do app.
