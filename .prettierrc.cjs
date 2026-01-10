module.exports = {
  plugins: ['prettier-plugin-astro'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro'
      }
    }
  ],
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  endOfLine: 'lf'
};