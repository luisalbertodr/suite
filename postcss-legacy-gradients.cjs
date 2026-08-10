/**
 * Tailwind 3.3+ emite paradas de degradado con
 * `var(--tw-gradient-*-position)` vacío. En Safari/WebKit antiguos eso
 * invalida todo el `background-image` → login sin colores.
 */
module.exports = () => ({
  postcssPlugin: 'postcss-legacy-gradients',
  Declaration(decl) {
    if (!decl.value.includes('--tw-gradient-')) return;
    decl.value = decl.value
      .replace(/\s*var\(--tw-gradient-from-position\)/g, '')
      .replace(/\s*var\(--tw-gradient-via-position\)/g, '')
      .replace(/\s*var\(--tw-gradient-to-position\)/g, '');
  },
});
module.exports.postcss = true;
