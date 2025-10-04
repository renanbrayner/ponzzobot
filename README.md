# Bot de Kick por Inatividade de Voz

Bot Discord **TypeScript** que monitora canais de voz e automaticamente remove usuários que não falam dentro de um período configurável. Usa detecção avançada de atividade de voz (VAD) para evitar falsos positivos.

## 🎯 Funcionalidades

- Monitoramento em tempo real de canais de voz
- Detecção avançada de atividade de voz (VAD) com múltiplas camadas
- Sistema de elegibilidade (usuário só pode ser kickado uma vez por sessão)
- Áudio de contagem regressiva ao agendar kick
- Validação robusta (bot só kicka se estiver pronto no mesmo canal)
- Configuração completa via variáveis de ambiente
- Logs detalhados para debugging e calibração
- **Tipagem forte TypeScript** para desenvolvimento seguro

## 📋 Pré-requisitos

- Node.js 16+ (recomendado 24+)
- Conta de bot Discord com permissões adequadas
- `MESSAGE CONTENT INTENT` habilitado no Developer Portal

## 🚀 Instalação

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
   cp .env.example .env  # se disponível
   # Edite .env com suas configurações
   ```

4. **Execute o bot**
   ```bash
   # Modo desenvolvimento (com hot reload)
   npm run dev

   # Produção (precisa compilar primeiro)
   npm run build
   npm start
   ```

## ⚙️ Configuração

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

# Tempo de inatividade para kick (ms)
INACTIVITY_TIMEOUT=2000

# Parâmetros VAD (Detecção de Atividade de Voz)
VAD_THRESHOLD=3000          # Acima disso é potencial fala
VAD_FLOOR=1200             # Abaixo disso é ruído ignorado
VAD_SUSTAIN_MS=150         # Tempo contínuo acima do threshold
VAD_COOLDOWN_MS=400        # Cooldown pós-confirmação
VAD_THRESHOLD_STRONG=7000  # Fala forte = cancelamento imediato
```

## 🎮 Comandos

- `!entrar` - Bot entra no canal de voz atual
- `!sair` - Bot sai do canal de voz atual

## 🔧 VAD (Detecção de Atividade de Voz)

O bot usa um algoritmo VAD sofisticado com múltiplas camadas:

### Como Funciona

1. **Análise RMS** - Mede o volume do áudio em tempo real
2. **Média Móvel** - Suaviza leituras com janela de 3 frames
3. **Detecção por Limiares** - múltiplos níveis de sensibilidade
4. **Verificação de Sustentação** - exige fala contínua
5. **Análise de Proporção** - % de frames acima do threshold

### Parâmetros VAD Explicados

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `VAD_FLOOR` | 1200 | Abaixo disso = ruído ignorado |
| `VAD_THRESHOLD` | 3000 | Acima disso = potencial fala |
| `VAD_THRESHOLD_STRONG` | 7000 | Fala muito forte = cancela imediatamente |
| `VAD_SUSTAIN_MS` | 150 | Tempo mínimo de fala contínua |
| `VAD_COOLDOWN_MS` | 400 | Tempo de espera após detecção |

### Calibração

Use os logs `[VADDBG]` para calibrar:
```bash
# Exemplo de log para calibração
[VADDBG] Usuario avgRMS=3200
```

- Se o bot não detecta fala: diminua `VAD_THRESHOLD`
- Se o bot detecta ruído: aumente `VAD_FLOOR` e `VAD_THRESHOLD`

## 📁 Estrutura do Projeto

```
deznoveoito/
├── src/                    # Código TypeScript modular
│   ├── index.ts           # Bootstrap principal
│   ├── config.ts          # Configurações centralizadas
│   ├── bot/
│   │   ├── client.ts      # Client Discord tipado
│   │   └── voice/
│   │       ├── connection.ts  # Conexões e validações
│   │       ├── audio.ts       # Player de áudio
│   │       ├── vad.ts         # Detecção VAD
│   │       ├── receiver.ts    # Subscribe/decoder Opus
│   │       └── kick.ts        # Elegibilidade e timeouts
│   └── events/
│       ├── messageCreate.ts   # Comandos !entrar !sair
│       └── voiceStateUpdate.ts # Eventos de voz
├── dist/                   # JavaScript compilado
├── assets/
│   └── contagem.ogg      # Áudio tocado ao agendar kick
├── package.json           # Dependências e scripts TypeScript
├── tsconfig.json         # Configuração do TypeScript
├── .env                  # Configurações (não commitar)
├── .gitignore           # Arquivos ignorados pelo git
└── README.md            # Esta documentação
```

## 🔍 Logs e Debug

O bot fornece logs detalhados para troubleshooting:

- `[voice]` - Eventos de conexão de voz
- `[VAD]` - Detecções de fala confirmadas
- `[VADDBG]` - Valores RMS para calibração
- `[eligibility]` - Mudanças de elegibilidade
- `[kick-cancel]` - Kicks cancelados
- `[skip]` - Kicks pulados (bot não está pronto/correto)
- `[audio]` / `[audio-skip]` - Áudio tocado ou pulado
- `[bot]` - Eventos de movimentação do próprio bot

## 🛠️ Troubleshooting

### Problemas Comuns

**Bot não responde comandos:**
- Verifique se `MESSAGE CONTENT INTENT` está habilitado
- Confirme se o bot tem permissão `Send Messages`
- Verifique o token no `.env`

**Erro de criptografia:**
- Execute `npm install sodium-native`
- Reinicie o bot

**Bot não entra no canal:**
- Verifique permissão `Connect` e `Speak`
- Confirme se o bot tem `Move Members`

**VAD muito sensível:**
- Aumente `VAD_THRESHOLD` para 4000-5000
- Aumente `VAD_FLOOR` para 1500-2000
- Aumente `VAD_THRESHOLD_STRONG` para 8000+

**VAD não detecta fala:**
- Diminua `VAD_THRESHOLD` para 2000-2500
- Diminua `VAD_SUSTAIN_MS` para 100
- Diminua `VAD_FLOOR` para 800

### Logs Úteis

```bash
# Modo desenvolvimento (com hot reload)
npm run dev

# Modo produção (necessita compilação)
npm run build
npm start

# Logs de calibração VAD
grep "\[VADDBG\]" output.txt

# Logs de skips/validações
grep "\[skip\]\|\[audio-skip\]" output.txt
```

### TypeScript

```bash
# Verificar tipos sem compilar
npm run typecheck

# Compilar para produção
npm run build
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie feature branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para branch (`git push origin feature/nova-funcionalidade`)
5. Abra Pull Request

## 📝 Licença

MIT License - ver arquivo LICENSE para detalhes

## 🔧 Desenvolvimento

### Scripts Disponíveis
```bash
npm run dev      # Desenvolvimento com hot reload (ts-node-dev)
npm run build    # Compila TypeScript para JavaScript
npm run start    # Executa versão compilada
npm run typecheck # Verifica tipos sem compilar
```

### Dependências Principais
- `discord.js` - API Discord
- `@discordjs/voice` - Funcionalidades de voz
- `prism-media` - Processamento de áudio
- `typescript` - Tipagem forte e compilação
- `ts-node-dev` - Execução TypeScript com hot reload
- `dotenv` - Gerenciamento de variáveis de ambiente
- `sodium-native` - Criptografia de voz

### Arquitetura TypeScript

O projeto utiliza uma arquitetura modular com:

- **`src/config.ts`** - Configurações centralizadas tipadas
- **`src/bot/`** - Módulos do bot (client, voice, eventos)
- **`src/events/`** - Handlers de eventos Discord
- **Tipagem forte** em todas as interações Discord
- **Separação de responsabilidades** para fácil manutenção

### Notas Técnicas

- **Validação robusta**: Bot só kicka se estiver `ready` no mesmo canal do usuário
- **Sistema de elegibilidade**: Cada usuário só pode ser kickado uma vez por sessão
- **Áudio contextual**: `contagem.ogg` só toca quando bot está pronto no canal
- **Cancelamento automático**: Timeouts são cancelados quando bot sai/muda de canal
- **VAD multicamadas**: Fast path, média móvel, análise de proporção e sustentação
- **Todos os tempos** em milissegundos
- **Suporte a múltiplos servidores** simultaneamente