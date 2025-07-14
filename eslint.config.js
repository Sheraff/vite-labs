import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

// module.exports = {
//   root: true,
//   env: { browser: true, es2020: true },
//   extends: [
//     'eslint:recommended',
//     'plugin:@typescript-eslint/recommended',
//     'plugin:react-hooks/recommended',
//   ],
//   ignorePatterns: ['dist', '.eslintrc.cjs'],
//   parser: '@typescript-eslint/parser',
//   plugins: ['react-refresh'],
//   rules: {
//     '@typescript-eslint/no-explicit-any': 'off',
//     '@typescript-eslint/no-namespace': 'off',
//     '@typescript-eslint/ban-types': 'off',
//     'no-constant-condition': ['error', { checkLoops: 'allExceptWhileTrue' }],
//     'react-refresh/only-export-components': [
//       'warn',
//       {
//         allowConstantExport: true,
//         allowExportNames: ["meta"]
//       },
//     ],
//   },
// }


export default [
	// Base configuration for all files
	{
		ignores: ['dist/**', '.eslintrc.cjs', 'src/router.ts']
	},

	// JavaScript/TypeScript files
	{
		files: ['**/*.{js,jsx,ts,tsx}'],
		settings: { react: { version: 'detect' } },
		languageOptions: {
			ecmaVersion: 2025,
			sourceType: 'module',
			parser: typescriptParser,
			globals: {
				JSX: 'readonly',
				...globals.browser,
				...globals.node,
			}
		},
		plugins: {
			'@typescript-eslint': typescript,
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh
		},
		rules: {
			// ESLint recommended rules
			...js.configs.recommended.rules,

			// TypeScript ESLint recommended rules
			...typescript.configs.recommended.rules,

			// React Hooks rules
			...reactHooks.configs.recommended.rules,

			// Custom rules from your original config
			'no-undef': 'off', // Handled by TypeScript
			'no-redeclare': 'off', // Handled by TypeScript
			'@typescript-eslint/no-unused-vars': 'off',
			'no-unused-labels': 'off',
			'no-mixed-spaces-and-tabs': 'off',
			'no-constant-condition': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-namespace': 'off',
			'@typescript-eslint/no-this-alias': 'off',
			'@typescript-eslint/ban-types': 'off',
			'react-refresh/only-export-components': [
				'warn',
				{
					allowConstantExport: true,
					allowExportNames: ['meta']
				}
			]
		}
	}
]
