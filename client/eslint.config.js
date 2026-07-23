const react = require('eslint-plugin-react');
const globals = require('globals');

module.exports = [
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: {
      react: react,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...Object.fromEntries(
          Object.entries({
            ...globals.browser,
            ...globals.es2021,
          }).filter(([key]) => key.trim() === key)
        ),
        AudioWorkletGlobalScope: 'readonly',
        AudioWorkletProcessor: 'readonly',
        AudioWorkletNode: 'readonly',
      },
    },
    rules: {
      // Add your rules here
      'react/prop-types': 'off',
      // User-facing attribute strings must go through the translation layer;
      // a raw literal here is invisible to the EN/DE parity net and leaks
      // English into the German UI (the "Sages"/"List view" class of bug).
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|title|placeholder)$/] > Literal",
          message:
            'Use tString(...) for aria-label/title/placeholder so the string exists in both languages.',
        },
      ],
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: [
                '**/hooks/useFigureManager',
                '**/hooks/useSeedManager',
                '**/hooks/useConversationFlow',
                '**/hooks/useModeManager',
                '**/hooks/useCouncilManager',
                '**/hooks/useAppState',
                '**/hooks/useModalStates'
              ],
              message: 'Import the corresponding view-model from src/vm/ instead of using monster hooks directly.'
            }
          ]
        }
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['src/vm/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'warn',
        {
          name: 'localStorage',
          message: 'Use LocalStorageAdapter from src/storage/localAdapter instead of direct localStorage access.',
        },
      ],
    },
  },
];
