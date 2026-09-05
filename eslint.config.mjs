import eslintPluginAstro from 'eslint-plugin-astro';

export default [
  {
    ignores: ['dist/**', '.astro/**', 'temp/**', 'node_modules/**'],
  },
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {
      // override/add rules settings here, such as:
      // "astro/no-set-html-directive": "error"
    }
  }
];
