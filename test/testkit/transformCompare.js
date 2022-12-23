const babel = require('@babel/core')
const ImportToInlineRequirePlugin = require('../../src/index')

const normalize = (str) => {
    // without additional presets or plugins babel transform outputs
    // additional code artifacts we shouldn't care about when writing testes
    return str
        .replace(/;/g, '')
        .replace(/^(\s+)/gm, '')
        .replace(/\t/g, '')
        .replace(/\n+/g, '\n')
        .replace(/"/g, "'")
        .replace("'use strict'", '')
        .trim()
}

const transformCompare = (source, expected, config, filename) => {
    const actual = babel.transformSync(source, {
        filename,
        plugins: [[ImportToInlineRequirePlugin, { verbose: !!process.env.VERBOSE, ...config }]],
        compact: false,
    }).code
    expect(normalize(actual)).toEqual(normalize(expected))
}

module.exports = transformCompare
