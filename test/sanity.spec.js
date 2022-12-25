const transformCompare = require('./testkit/transformCompare')

const allTestsWithPluginConfig = (config = {}) => () => {
	const testTransform = (source, expected) => {
		transformCompare(source, expected, config, 'file.js')
	}

	test('Inline namespace import', () => {
		const source = `import { namespace } from 'module'
		const value1 = namespace
		const value2 = namespace.field
		namespace.function()`

		const expected = `const value1 = require('module').namespace
		const value2 = require('module').namespace.field
		require('module').namespace.function()`

		testTransform(source, expected)
	})

	test('Inline renamed namespace import', () => {
		const source = `import { namespace as something } from 'module'
		const value1 = something
		const value2 = something.field
		const value3 = namespace`

		const expected = `const value1 = require('module').namespace
		const value2 = require('module').namespace.field
		const value3 = namespace`

		testTransform(source, expected)
	})

	test('Inline default export', () => {
		const source = `import defExports from 'module'
		const value1 = defExports
		const value2 = defExports.field`

		const expected = `const value1 = require('module').default
		const value2 = require('module').default.field`

		testTransform(source, expected)
	})

	test('Inline importAll namespaces alias', () => {
		const source = `import * as allThings from 'module'
		const value1 = allThings
		const value2 = allThings.field`

		const expected = `const value1 = require('module')
		const value2 = require('module').field`

		testTransform(source, expected)
	})

	test('Dont inline object keys', () => {
		const source = `import { namespace } from 'module'
		const obj = {
		 namespace: 'something'
		}`

		const expected = `import { namespace } from 'module'
		const obj = {
		  namespace: 'something'
		}`

		testTransform(source, expected)
	})

	test('Inline object value assignments', () => {
		const source = `import { namespace as other } from 'module'
		const obj = {
		 something: other,
		 other,
		}`

		const expected = `const obj = {
		  something: require('module').namespace,
		  other: require('module').namespace
		}`

		testTransform(source, expected)
	})

	test('Dont inline shadowed function arguments', () => {
		const source = `import { namespace } from 'module'
		const fn = function (namespace, other) {}`

		const expected = `import { namespace } from 'module'
		const fn = function (namespace, other) {}`

		testTransform(source, expected)
	})

	test('Dont inline named function declarations', () => {
		const source = `import { namespace } from 'module'
		const f = () => {
			function namespace(args) {}
		}`

		const expected = `import { namespace } from 'module'
		const f = () => {
			function namespace(args) {}
		}`

		testTransform(source, expected)
	})

	test('Dont inline named function expressions', () => {
		const source = `import { namespace } from 'module'
		const fn = function namespace(args) {}`

		const expected = `import { namespace } from 'module'
		const fn = function namespace(args) {}`

		testTransform(source, expected)
	})

	test('Inline named export statements', () => {
		const source = `import { namespace } from 'module'
		const anotherExportedValue = true

		export { namespace as myNamespace, anotherExportedValue }`

		const expected = `
		const anotherExportedValue = true
		const __importToInlineRequirePlugin_exported_myNamespace__namespace = require('module').namespace
		export { __importToInlineRequirePlugin_exported_myNamespace__namespace as myNamespace, anotherExportedValue }
		`

		testTransform(source, expected)
	})

	test('Inline multiple named export statements of same import', () => {
		const source = `import { namespace } from 'module'

		export { namespace as myNamespace }
		export { namespace as myOtherNamespace }`

		const expected = `const __importToInlineRequirePlugin_exported_myNamespace__namespace = require('module').namespace
		export { __importToInlineRequirePlugin_exported_myNamespace__namespace as myNamespace }
		const __importToInlineRequirePlugin_exported_myOtherNamespace__namespace = require('module').namespace
		export { __importToInlineRequirePlugin_exported_myOtherNamespace__namespace as myOtherNamespace }
		`

		testTransform(source, expected)
	})

	test('Inline invoked imported function', () => {
		const source = `import { namespace } from 'module'

		const fn = (arg) => {
			return namespace(arg)
		}`

		const expected = `
		const fn = arg => {
			return require('module').namespace(arg);
		}`

		testTransform(source, expected)
	})
}

describe('Import to inline require babel plugin', allTestsWithPluginConfig({}))

describe(
	'Import to inline require babel plugin - naiveStringReplace',
	allTestsWithPluginConfig({ naiveStringReplace: true })
)

