/**
 * @deprecated This is still required for formatting markdown files. Will be removed in the future once Biome supports markdown formatting.
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  printWidth: 120,
  trailingComma: 'es5',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  quoteProps: 'consistent',
  jsxSingleQuote: true,
  arrowParens: 'avoid',
  endOfLine: 'lf',
}

export default config
