# Deznoveoito - Bot Discord de Kick por Inatividade

> Hoje rolou uma sessão de vibecoding pesada: ressuscitei um notebook velho com Rocky Linux, Cockpit e Dokploy, e fiz deploy de um bot do Discord para resolver uma "regra" do meu amigo Ponzzo. No servidor dele, quem entra na call tem "10 segundos" pra dizer quem é… só que Ponzzo conta 1, 2, 3, 7, 10. Ou seja: 3 segundos e kick.

> Resultado: criei um bot que faz exatamente isso. Quando alguém entra no canal ele conta 10 segundos em 3 e, se a pessoa ficar muda, tchau.

Bot Discord TypeScript que monitora canais de voz e automaticamente remove usuários que não falam dentro de um período configurável. Usa detecção avançada de atividade de voz (VAD) para evitar falsos positivos.

## 🎯 Funcionalidades

- Monitoramento em tempo real de canais de voz
- Detecção avançada de atividade de voz (VAD) com múltiplas camadas
- Sistema de elegibilidade (usuário só pode ser kickado uma vez por sessão)
- **Timeout adaptativo**: +500ms de penalidade a cada kick consecutivo
- Áudio de contagem regressiva ao agendar kick
- Validação robusta (bot só kicka se estiver pronto no mesmo canal)
- Configuração completa via variáveis de ambiente
- Logs detalhados para debugging e calibração
- Tipagem forte TypeScript para desenvolvimento seguro

## 🚀 Instalação Rápida

### Opção 1: Docker (Recomendado)

```bash
# Build
docker build -t deznoveoito:latest .

# Run
docker run -d --name bot --restart unless-stopped \
  -e DISCORD_TOKEN=SEU_TOKEN_AQUI \
  -e NODE_ENV=production \
  deznoveoito:latest
```

### Opção 2: Local

1. **Clone o repositório**
   ```bash
   git clone <URL-DO-REPOSITORIO>
   cd deznoveoito
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure o ambiente**
   ```bash
   # Edite .env com suas configurações
   DISCORD_TOKEN=seu_token_aqui
   INACTIVITY_TIMEOUT=2000
   ```

4. **Execute o bot**
   ```bash
   # Desenvolvimento (com hot reload)
   npm run dev

   # Produção
   npm run build
   npm start
   ```

## ⚙️ Configuração do Bot

### 1. Criar o Bot Discord

1. Vá para [Discord Developer Portal](https://discord.com/developers/applications)
2. Crie uma nova aplicação → Bot
3. Habilite **MESSAGE CONTENT INTENT** em *Privileged Intents*
4. Copie o token para `.env`

### 2. Convidar o Bot

1. Em OAuth2 → URL Generator, selecione:
   - `bot`
   - `applications.commands`
2. Permissões necessárias:
   - **Move Members** (essencial para desconectar usuários)
   - **Connect** (entrar em canais de voz)
   - **Speak** (tocar áudio de contagem)
   - **Read Messages/View Channels**
   - **Send Messages**
3. Use o URL gerado para convidar ao servidor

### 3. Variáveis de Ambiente

```bash
# Token do bot (obrigatório)
DISCORD_TOKEN=seu_token_aqui

# Tempo base de inatividade (ms)
INACTIVITY_TIMEOUT=2000

# Incremento por kick consecutivo (ms)
USER_TIMEOUT_INCREMENT=500

# Parâmetros VAD (Detecção de Atividade de Voz)
VAD_THRESHOLD=3000          # Acima disso é potencial fala
VAD_FLOOR=1200             # Abaixo disso é ruído ignorado
VAD_SUSTAIN_MS=150         # Tempo contínuo acima do threshold
VAD_COOLDOWN_MS=400        # Cooldown pós-confirmação
VAD_THRESHOLD_STRONG=7000  # Fala forte = cancelamento imediato
```

## 🎮 Comandos

- `!entrar` ou `/entrar` - Bot entra no canal de voz atual
- `!sair` ou `/sair` - Bot sai do canal de voz atual

## 🏆 Sistema de Timeout Adaptativo

O bot implementa um sistema inteligente de penalidades:

- **1º kick**: 2000ms + (1 × 500ms) = 2500ms
- **2º kick**: 2000ms + (2 × 500ms) = 3000ms
- **3º kick**: 2000ms + (3 × 500ms) = 3500ms
- **Reset**: Volta para 2000ms quando o usuário fala com sucesso

Isso encoraja usuários a participarem e penaliza quem fica repetidamente inativo.

## 📁 Estrutura do Projeto

```
deznoveoito/
├── src/                    # Código TypeScript modular
│   ├── index.ts           # Bootstrap principal
│   ├── config.ts          # Configurações centralizadas
│   ├── bot/
│   │   ├── client.ts      # Client Discord tipado
│   │   ├── commands/      # Slash commands (/entrar, /sair)
│   │   └── voice/         # Sistema de voz/VAD
│   │       ├── connection.ts  # Conexões e validações
│   │       ├── audio.ts       # Player de áudio
│   │       ├── vad.ts         # Detecção VAD
│   │       ├── receiver.ts    # Subscribe/decoder Opus
│   │       └── kick.ts        # Elegibilidade e timeouts
│   └── events/
│       ├── messageCreate.ts   # Comandos !entrar !sair
│       ├── voiceStateUpdate.ts # Eventos de voz
│       └── interactionCreate.ts # Slash commands
├── dist/                   # JavaScript compilado
├── assets/
│   └── contagem.ogg      # Áudio tocado ao agendar kick
├── Dockerfile             # Build para produção
├── .dockerignore         # Arquivos ignorados no build
└── package.json          # Dependências e scripts
```

## 🔍 Logs e Debug

O bot fornece logs detalhados para troubleshooting:

- `[voice]` - Eventos de conexão de voz
- `[VAD]` - Detecções de fala confirmadas
- `[VADDBG]` - Valores RMS para calibração
- `[eligibility]` - Mudanças de elegibilidade
- `[kick-cancel]` - Kicks cancelados
- `[skip]` - Kicks pulados (bot não está pronto/correto)
- `[audio]` - Áudio tocado ou pulado

### Calibração VAD

Use os logs `[VADDBG]` para calibrar:
```bash
# Exemplo de log para calibração
[VADDBG] Usuario avgRMS=3200
```

- Se o bot não detecta fala: diminua `VAD_THRESHOLD`
- Se o bot detecta ruído: aumente `VAD_FLOOR` e `VAD_THRESHOLD`

## 🐳 Docker e Deploy

### Build e Run

```bash
# Build local
docker build -t deznoveoito:latest .

# Run em desenvolvimento
docker run --rm -it --name bot \
  -e DISCORD_TOKEN=SEU_TOKEN_AQUI \
  deznoveoito:latest

# Run em produção
docker run -d --name bot --restart unless-stopped \
  -e DISCORD_TOKEN=SEU_TOKEN_AQUI \
  -e NODE_ENV=production \
  -e INACTIVITY_TIMEOUT=3000 \
  --user 10001:10001 \
  deznoveoito:latest
```

### Deploy no Dokploy

- Build Type: `Dockerfile`
- Docker File: `./Dockerfile`
- Docker Context Path: `.`
- Docker Build Stage: *(deixe vazio)*
- Configure as variáveis de ambiente na interface

## 🛠️ Troubleshooting

### Problemas Comuns

**Bot não responde comandos:**
- Verifique se `MESSAGE CONTENT INTENT` está habilitado
- Confirme se o bot tem permissão `Send Messages`
- Verifique o token no `.env`

**Erro de criptografia:**
- Execute `npm install sodium-native`
- Reinicie o bot

**VAD muito sensível:**
- Aumente `VAD_THRESHOLD` para 4000-5000
- Aumente `VAD_FLOOR` para 1500-2000

**VAD não detecta fala:**
- Diminua `VAD_THRESHOLD` para 2000-2500
- Diminua `VAD_SUSTAIN_MS` para 100

## 📝 Licença

MIT License

---

> Moral: dá pra transformar tralha em infra, regras arbitrárias em software e deploy em muita resenha no discord com os amigos