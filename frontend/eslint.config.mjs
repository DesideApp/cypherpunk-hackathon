// ESLint v9 flat config – base + 3 ajustes mínimos
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  // Ignorar carpetas de build y similares
  { ignores: ['dist', 'build', 'coverage', 'node_modules'] },

  // Base JS recomendada
  js.configs.recommended,

  // Base TS recomendada (no type-checked para ir ligeros)
  ...tseslint.configs.recommended,

  // Regla general para código de app (JS/TS/React) en el navegador
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Navegador y ES modernos
        ...globals.browser,
        ...globals.es2021,

        // APIs web explícitas que tu código usa (evita no-undef)
        fetch: 'readonly',
        FileReader: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        RTCPeerConnection: 'readonly',
        RTCSessionDescription: 'readonly',
        RTCIceCandidate: 'readonly',
        crypto: 'readonly',
        requestAnimationFrame: 'readonly',
        CustomEvent: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        IntersectionObserver: 'readonly',

        // En Vite a veces se usa process.* en cliente (definido por el bundler). Lo marcamos como global de solo-lectura para evitar no-undef.
        process: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      react,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // React
      'react/prop-types': 'off',              // usas JS/TS mixto y esto mete mucho ruido
      'react/react-in-jsx-scope': 'off',      // con React 17+ no hace falta importar React
      // Hooks
      ...reactHooks.configs.recommended.rules,
      // (1) Permite catch vacío. El resto de bloques vacíos siguen siendo error.
      'no-empty': ['error', { allowEmptyCatch: true }],

      // (2) Permite expresiones cortas y ternarias sin asignación (a && b()).
      '@typescript-eslint/no-unused-expressions': ['error', {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true
      }],

      // (3) _prefijo ignora "unused" en args/vars/catch: (_e, _unused, etc.)
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_'
      }],
      // Comentarios TS
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },

  // Archivos TS/TSX: ajustes adicionales
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // pragmático para que no bloquee
    },
  },

  // Declaraciones .d.ts → no molestes por “unused”
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },

  // Tests (Jest/Vitest)
  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest, // si usas Vitest no pasa nada, sólo añade globals de test
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Ficheros de Node (configs, scripts)
  {
    files: [
      'vite.config.{js,ts,mjs,cjs}',
      '**/tailwind.config.{js,ts}',
      '**/*.config.{js,ts,mjs,cjs}',
      'scripts/**/*.{js,ts,mjs,cjs}',
      'eslint.config.mjs'
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
)
