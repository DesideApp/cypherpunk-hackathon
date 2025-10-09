# Deside Frontend

SPA en React + Vite. Cliente de mensajería E2EE con transporte RTC/Relay y autenticación basada en cookies/CSRF.

- Cómo arrancar el proyecto y los modos (demo/dev): ver el [README de la raíz](../README.md).
- Diferencias y flags de ejecución: ver [docs/modes.md](../docs/modes.md).

## Swap (Jupiter) — cambio de red sin afectar WS/RTC

- La app core (WS/RTC) permanece en devnet usando `VITE_WS_URL` y `VITE_SOLANA_RPC` del `.env`.
- El swap usa variables propias en `.env`:
  - `VITE_JUPITER_MODE=devnet | mainnet`
  - `VITE_JUPITER_RPC_DEVNET`, `VITE_JUPITER_RPC_MAINNET`
- Cambia solo `VITE_JUPITER_MODE` y reinicia Vite para probar el swap en mainnet sin romper presencia/RTC.
- Más detalles: [docs/runbook-env.md](../docs/runbook-env.md)

## Estructura de código

```
src/
  features/            # Funcionalidades por dominio
    auth/              # Inicio de sesión y sesión
    messaging/         # Dominio, UI, transports, store, utils
    contacts/          # Contactos
    wallet/            # Integración con wallets
    profile/           # Perfil de usuario
    layout/            # Layout, navegación, contextos

  shared/              # Infra transversal
    config/            # Resolución de env y políticas de cliente (env.js)
    socket/            # Cliente WS, heartbeats, presencia
    e2e/               # Helpers de cifrado
    components/        # Componentes reutilizables
    services/          # Servicios compartidos
    utils/             # Utilidades
    types/             # Tipos

  adapters/
    wallet-adapter/    # Integración (core, UI, tema, tipos)

  pages/               # Páginas y rutas de alto nivel
public/                # Estáticos y assets
```

## Funcionamiento

- Autenticación: el login vía REST establece cookies HTTP-only; se gestiona un token CSRF en almacenamiento del navegador. El cliente HTTP y Socket.IO reutilizan estas credenciales en peticiones y handshake.
- Mensajería: el cliente intenta RTC data channel cuando es elegible y recurre a relay si no lo es o si falla. La selección sigue las políticas definidas en `shared/config/env.js`.
- E2EE: el cifrado ocurre en el cliente. Si la clave requerida no está presente, la interfaz impide el envío y lo comunica claramente.

## Modos (referencia breve)

- Demo: orientado a evaluación rápida sin secretos, con políticas conservadoras (por ejemplo, priorizar relay) y espacios de almacenamiento/cookies segregados.
- Dev: respeta tu configuración local y habilita RTC cuando aplica; mantiene los mismos contratos/UX.
- Detalle de diferencias y flags en [docs/modes.md](../docs/modes.md). Los ejemplos de configuración están en los `.env.example` (no se duplican aquí).

## Uso básico

- Desarrollo desde la raíz: `npm run dev:frontend`.
- Verificación y calidad: `lint`, `test`, `build` disponibles en `frontend/package.json`.
- Variables de entorno: consulta `frontend/.env.example`.

## Consideraciones prácticas

- Cambios en configuración (`VITE_*`) requieren reiniciar el servidor de Vite para que la app recoja los valores.
- Si RTC no se establece, los logs de consola y los indicadores de transporte ayudan a diagnosticar por qué se cae a relay (presencia, timeouts, etc.).

## Troubleshooting

- WebSocket no conecta: alinea puertos/orígenes con el backend y confirma que hay sesión válida antes del handshake.
- Siempre cae a relay: revisa presencia/heartbeats y condiciones para abrir el data channel.
- Envío bloqueado por E2EE: configura la clave compartida cuando tu escenario lo requiera.

## Referencias

- Topología de desarrollo: [docs/dev-setup.md](../docs/dev-setup.md)
- Modos y flags: [docs/modes.md](../docs/modes.md)
