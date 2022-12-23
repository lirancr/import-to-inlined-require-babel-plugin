const ImportToInlineRequirePlugin = require("../src");
const transformCompare = require('./testkit/transformCompare')

describe('Configuration', () => {
    describe('Verify config', () => {
        const isValidConfig = (config) => {
            try {
                ImportToInlineRequirePlugin(null, config)
                return true
            } catch (e) {
                return false
            }
        }

        describe('verbose', () => {
            test('accept boolean value', () => {
                const config = { verbose: true }

                expect(isValidConfig(config)).toBeTruthy()
            })

            test('reject non-boolean value', () => {
                const config = { verbose: 'true' }

                expect(isValidConfig(config)).toBeFalsy()
            })
        })

        describe('naiveStringReplace', () => {
            test('accept boolean value', () => {
                const config = { naiveStringReplace: true }

                expect(isValidConfig(config)).toBeTruthy()
            })

            test('reject non boolean value', () => {
                const config = { naiveStringReplace: 'true' }

                expect(isValidConfig(config)).toBeFalsy()
            })
        })

        describe('excludeFiles', () => {
            test('accept string array item', () => {
                const config = { excludeFiles: ['str'] }

                expect(isValidConfig(config)).toBeTruthy()
            })

            test('accept regex array item', () => {
                const config = { excludeFiles: [/str/] }

                expect(isValidConfig(config)).toBeTruthy()
            })

            test('reject non string / regex array item', () => {
                const config = { excludeFiles: [2] }

                expect(isValidConfig(config)).toBeFalsy()
            })

            test('reject regex array item with "g" flag', () => {
                const config = { excludeFiles: [/str/g] }

                expect(isValidConfig(config)).toBeFalsy()
            })

            test('reject non array value', () => {
                const config = { excludeFiles: 'str' }

                expect(isValidConfig(config)).toBeFalsy()
            })
        })

        describe('excludeModules', () => {
            test('accept string array item', () => {
                const config = { excludeModules: ['str'] }

                expect(isValidConfig(config)).toBeTruthy()
            })

            test('accept regex array item', () => {
                const config = { excludeModules: [/str/] }

                expect(isValidConfig(config)).toBeTruthy()
            })

            test('reject non string / regex array item', () => {
                const config = { excludeModules: [2] }

                expect(isValidConfig(config)).toBeFalsy()
            })

            test('reject regex array item with "g" flag', () => {
                const config = { excludeModules: [/str/g] }

                expect(isValidConfig(config)).toBeFalsy()
            })

            test('reject non array value', () => {
                const config = { excludeModules: 'str' }

                expect(isValidConfig(config)).toBeFalsy()
            })
        })
    })

    test('dont inline imports in matched excludeFiles', () => {
        const source = `import { namespace } from 'module'
		const value1 = namespace`

        const expected = `var _module = require('module')
		var value1 = _module.namespace`

        transformCompare(source, expected, { excludeFiles: [/ignore/] }, 'ignoredFile.js')
    })

    test('dont inline imports of matched excludeModules regex', () => {
        const source = `import { namespace } from 'module'
		import { otherNamespace } from 'ignoredModule'
		import { otherOtherNamespace } from 'ignoredModule/subModule'
		const value1 = namespace
		const value2 = otherNamespace
		const value3 = otherOtherNamespace`

        const expected = `var _ignoredModule = require('ignoredModule')
		var _subModule = require('ignoredModule/subModule')
		var value1 = require('module').namespace
		var value2 = _ignoredModule.otherNamespace
		var value3 = _subModule.otherOtherNamespace`

        transformCompare(source, expected, { excludeModules: [/ignore/] }, 'file.js')
    })

    test('dont inline imports of matched excludeModules string', () => {
        const source = `import { namespace } from 'module'
		import { otherNamespace } from 'ignoredModule'
		import { otherOtherNamespace } from 'ignoredModule/subModule'
		import { otherIncludedNamespace } from 'notignoredModule'
		const value1 = namespace
		const value2 = otherNamespace
		const value3 = otherOtherNamespace
		const value4 = otherIncludedNamespace`

        const expected = `var _ignoredModule = require('ignoredModule')
		var _subModule = require('ignoredModule/subModule')
		var value1 = require('module').namespace
		var value2 = _ignoredModule.otherNamespace
		var value3 = _subModule.otherOtherNamespace
		var value4 = require('notignoredModule').otherIncludedNamespace`

        transformCompare(source, expected, { excludeModules: ['ignoredModule'] }, 'file.js')
    })
})
