const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    // Flat config has no .eslintignore. Build output, coverage and generated
    // sources are not hand-edited, so linting them is pure noise.
    ignores: [
      'build/**',
      'dist/**',
      'out/**',
      'coverage/**',
      'node_modules/**',
      '.wrangler/**',
      'docs/**',
      // Written by scripts/extract-public-data.mjs on every build.
      'src/data/public/themeSeedCrossRef.ts',
      'src/data/public/figuresCatalog.ts',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: {
      react: react,
      // The source already carries 17 react-hooks/exhaustive-deps disable
      // comments, so the rules were meant to run. Without the plugin ESLint
      // reports each of those lines as an unknown-rule error instead.
      'react-hooks': reactHooks,
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
      // React ships rules-of-hooks as an error. It stays a warning until the
      // conditional-hook findings it surfaced are cleared, so turning the
      // rules on does not make lint fail on code nobody has looked at yet.
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
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
    // Without an explicit parser, espree chokes on every TS construct and the
    // rules above never run on a single .ts/.tsx file.
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Deliberately no `project`/`projectService`: type-aware linting needs
        // tsconfig plumbing and costs a full program build per run.
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Baseline: the non-type-aware recommended set (also switches off the
      // core rules it replaces), then split by what a finding actually means.
      ...tsPlugin.configs.recommended.rules,

      // Correctness. These flag code that is wrong, not code that is untidy.
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',

      // Style and preference. Same severity as the custom rules above.
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-unnecessary-type-constraint': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      '@typescript-eslint/prefer-namespace-keyword': 'warn',
      '@typescript-eslint/triple-slash-reference': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
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
