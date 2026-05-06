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
