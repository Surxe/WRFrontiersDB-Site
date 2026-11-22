import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import astroPlugin from 'eslint-plugin-astro';
import astroParser from 'astro-eslint-parser';

// The movement simulation (src/scripts/movement/) is plain TypeScript: no
// three.js, no DOM, nothing from the viewers or robot code. The map viewer
// depends on it, never the reverse. Inside it, data/ depends on nothing else
// in movement/, engine/ never reaches into rules/, and only
// collision/rapier.ts touches Rapier: everything else uses the CollisionWorld
// interface. (Flat config replaces a rule's options per block, so each block
// lists every pattern that applies to it.)
const MOVEMENT = 'src/scripts/movement';
const NOT_VIEWER = [
  {
    group: ['three', 'three/*'],
    message: 'movement/ must not depend on three.js.',
  },
  {
    regex: '(^|/)(map_viewer|viewer3d|robot|model_viewer)(/|$)',
    message:
      'movement/ must not depend on the viewers or robot code; they depend on it.',
  },
];
const NOT_RAPIER = [
  {
    group: ['@dimforge/*'],
    message:
      'Only movement/collision/rapier.ts uses Rapier; depend on collision/world.',
  },
];
const NOT_RAPIER_IMPL = [
  {
    regex: '(^|/)collision/rapier$',
    message:
      'Depend on the CollisionWorld interface (collision/world), not Rapier.',
  },
];
const restrict = (...groups) => ['error', { patterns: groups.flat() }];
const movementRules = [
  {
    files: [`${MOVEMENT}/**/*.ts`],
    rules: {
      'no-restricted-imports': restrict(NOT_VIEWER, NOT_RAPIER),
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'requestAnimationFrame',
        'HTMLElement',
      ],
    },
  },
  {
    files: [`${MOVEMENT}/collision/rapier.ts`],
    rules: { 'no-restricted-imports': restrict(NOT_VIEWER) },
  },
  {
    files: [`${MOVEMENT}/engine/**/*.ts`],
    rules: {
      'no-restricted-imports': restrict(
        NOT_VIEWER,
        NOT_RAPIER,
        NOT_RAPIER_IMPL,
        [
          {
            regex: '(^|/)rules(/|$)',
            message:
              'engine/ is stock UE; rules/ builds on it, not the reverse.',
          },
        ]
      ),
    },
  },
  {
    files: [`${MOVEMENT}/rules/**/*.ts`],
    rules: {
      'no-restricted-imports': restrict(
        NOT_VIEWER,
        NOT_RAPIER,
        NOT_RAPIER_IMPL
      ),
    },
  },
  {
    files: [`${MOVEMENT}/data/**/*.ts`],
    rules: {
      'no-restricted-imports': restrict(NOT_VIEWER, NOT_RAPIER, [
        {
          regex: '^\\.\\./',
          message: 'data/ depends on nothing else in movement/.',
        },
      ]),
    },
  },
];

export default [
  // Ignore patterns
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.astro/',
      'WRFrontiersDB-Data/',
      'public/WRFrontiersDB-Data/',
      '.agents/',
      'vendor/',
    ],
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // TypeScript already checks undefined identifiers (with the right DOM /
      // Node globals per file); typescript-eslint recommends disabling this.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
    },
  },

  // Astro files
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.astro'],
      },
      globals: {
        process: 'readonly',
      },
    },
    plugins: {
      astro: astroPlugin,
    },
    rules: {
      ...astroPlugin.configs.recommended.rules,
      'astro/no-set-html-directive': 'error',
      'astro/no-unused-css-selector': 'warn',
    },
  },

  // Client-side JavaScript files
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
  },

  // General rules for all files
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // TypeScript: @typescript-eslint/no-unused-vars (above) replaces the base
  // rule, which misreads parameter names in function types as unused.
  {
    files: ['**/*.ts'],
    rules: {
      'no-unused-vars': 'off',
    },
  },

  ...movementRules,
];
