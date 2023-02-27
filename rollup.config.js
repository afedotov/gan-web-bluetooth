
const pkg = require('./package.json');
const typescript = require('@rollup/plugin-typescript');

module.exports = {
    input: 'src/index.ts',
    external: Object.keys(pkg.dependencies),
    output: [
        {
            file: pkg.main,
            format: 'cjs'
        },
        {
            file: pkg.module,
            format: 'es'
        }
    ],
    plugins: [typescript()]
};
