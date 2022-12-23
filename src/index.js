const t = require('@babel/types')
const assert = require('assert').strict

const loggerFactory = (verbose) => (...args) => {
		verbose && console.log('ImportToInlineRequirePlugin:', ...args)
}

const isRegExp = (obj) => typeof obj?.test === 'function'
const assertOptions = (options) => {
	const AssertionError = (field, expected, received) => `Invalid plugin config value type for '${field}', expected: [${expected}], received: [${received}]`
	const assertRegex = (regex) => {
		const isObjectRegex = isRegExp(regex)
		if (isObjectRegex && regex.flags.includes('g')) {
			throw new Error('ImportToInlineRequirePlugin: Received forbidden flag "g" for RegExp: ' + regex.toString())
		}
		return isObjectRegex
	}

	assert(['undefined', 'boolean'].includes(typeof options.verbose), AssertionError('verbose', 'boolean', typeof options.verbose))
	assert(['undefined', 'boolean'].includes(typeof options.naiveStringReplace), AssertionError('naiveStringReplace', 'boolean', typeof options.naiveStringReplace))
	if (options.excludeFiles) {
		assert(Array.isArray(options.excludeFiles), AssertionError('excludeFiles', 'Array<string|RegExp>', typeof options.excludeFiles))
		for (let i = 0; i < options.excludeFiles.length; i++) {
			const file = options.excludeFiles[i]
			assert(typeof file === 'string' || assertRegex(file), AssertionError(`excludeFiles[${i}]`, 'string|RegExp', typeof file))
		}
	}
	if (options.excludeModules) {
		assert(Array.isArray(options.excludeModules), AssertionError('excludeModules', 'Array<string|RegExp>', typeof options.excludeModules))
		for (let i = 0; i < options.excludeModules.length; i++) {
			const module = options.excludeModules[i]
			assert(typeof module === 'string' || assertRegex(module), AssertionError(`excludeModules[${i}]`, 'string|RegExp', typeof module))
			if (typeof module === 'string' && module.endsWith('/')) {
				throw new Error(`ImportToInlineRequirePlugin: excludeModules[${i}] string value must not end with "/"`)
			}
		}
	}
	return options
}

/**
 * Options
 * - verbose <boolean=false> - toggle verbose logging
 * - naiveStringReplace <boolean=false> - use string literal value when modifying code instead of using AST nodes
 * - excludeFiles <Array<String|RegExp>>=[]> - skip replacing import statements in certain files
 * - excludeModules <Array<String|RegExp>>=[]> - skip replacing import statements of certain modules in all files
 */
const ImportToInlineRequirePlugin = (_, options) => {

	const { verbose, naiveStringReplace } = assertOptions(options)

	const logger = loggerFactory(verbose)
	const moduleImportRemoversStore = {}
	const pointerMappingStore = {}

	const excludeModules = (options.excludeModules || []).map((strOrRegExp) => {
		return isRegExp(strOrRegExp) ? strOrRegExp : new RegExp(`^${strOrRegExp}\/?`)
	})

	const checkStringOrRegExp = (strOrRegExp, value) => {
		return isRegExp(strOrRegExp) ? strOrRegExp.test(value) : value === strOrRegExp
	}

	const shouldSkipFile = (state) => {
		const currentFileName = currentFile(state)
		return currentFileName && !!(options.excludeFiles || []).find((strOrRegExp) => checkStringOrRegExp(strOrRegExp, currentFileName))
	}

	const shouldSkipModule = (moduleName) => {
		return moduleName && !!excludeModules.find((regExp) => regExp.test(moduleName))
	}

	const currentFile = (state) => state.file.opts.filename

	const moduleImportRemoversFor = (state) => {
		// babel re-uses idle plugin instances so any state we keep must be file partitioned
		if (!moduleImportRemoversStore[currentFile(state)]) {
			moduleImportRemoversStore[currentFile(state)] = {}
		}
		return moduleImportRemoversStore[currentFile(state)]
	}

	const pointerMappingFor = (state) => {
		// babel re-uses idle plugin instances so any state we keep must be file partitioned
		if (!pointerMappingStore[currentFile(state)]) {
			pointerMappingStore[currentFile(state)] = {}
		}
		return pointerMappingStore[currentFile(state)]
	}

	return {
		visitor: {
			Program: {
				exit(path, state) {
					const moduleImportsWithPotentialSideEffects = Object.keys(moduleImportRemoversFor(state))
					if (moduleImportsWithPotentialSideEffects.length > 0) {
						logger('Detected modules import with no code usage, these are potentially imports with intentional side effects so they are not removed from their declaration position by the plugin:', moduleImportsWithPotentialSideEffects, currentFile(state))
					}
					delete pointerMappingStore[currentFile(state)]
					delete moduleImportRemoversStore[currentFile(state)]
				}
			},
			ImportDeclaration(path, state) {
				const moduleName = path.node.source.value;

				if (shouldSkipFile(state) || shouldSkipModule(moduleName)) {
					return
				}

				moduleImportRemoversFor(state)[moduleName] = () => {
					path.remove()
					delete moduleImportRemoversFor(state)[moduleName]
				}

				path.node.specifiers.forEach((specifier) => {
					switch (specifier.type) {
						case 'ImportNamespaceSpecifier':
							// import * as name from '$module' ->  require('$module')
							pointerMappingFor(state)[specifier.local.name] = {
								code: `require('${moduleName}')`,
								ast: () => t.callExpression(t.identifier('require'), [t.stringLiteral(moduleName)]),
								moduleName,
							}

							logger('indexed', specifier.type, specifier.local.name)
							break;
						case 'ImportDefaultSpecifier':
							// import name from '$module' ->  require('$module').default
							pointerMappingFor(state)[specifier.local.name] = {
								code: `require('${moduleName}').default`,
								ast: () => t.memberExpression(
										t.callExpression(
											t.identifier('require'),
											[t.stringLiteral(moduleName)]
										),
										t.identifier('default')
									),
								moduleName,
							}
							logger('indexed', specifier.type, specifier.local.name, currentFile(state))
							break;
						case 'ImportSpecifier':
							// import { $name } from '$module' -> require('$module').$name
							// import { $name as otherName } from '$module' -> require('$module').$name
							pointerMappingFor(state)[specifier.local.name] = {
								code: `require('${moduleName}').${specifier.imported.name}`,
								ast: () => t.memberExpression(
										t.callExpression(
											t.identifier('require'),
											[t.stringLiteral(moduleName)]
										),
										t.identifier(specifier.imported.name)
									),
								moduleName,
							}
							logger('indexed', specifier.local.name, currentFile(state))
							break;
					}
				})
			},
			Identifier(path, state) {
				const shouldSkip = shouldSkipFile(state)
				if (shouldSkip) {
					return
				}

				const pointer = pointerMappingFor(state)[path.node.name]
				if (pointer?.ast) {
					const exclude = {
						isImportStatement: ['ImportNamespaceSpecifier', 'ImportSpecifier', 'ImportDefaultSpecifier'].includes(path.parentPath.type),
						isObjectPropertyAccessorWithSameName: path.parentPath.type === 'MemberExpression' && path.key !== 'object',
						isObjectPropertyDeclarationKey: path.parentPath.type === 'ObjectProperty' && path.key === 'key',
						isFunctionArgument: path.listKey === 'params' && typeof path.key === 'number',
						isNamedFunctionDeclaration: path.parentPath.type === 'FunctionDeclaration' && path.key === 'id',
						isNamedFunctionExpression: path.parentPath.type === 'FunctionExpression' && path.key === 'id',
						isNamedArrowFunctionExpression: path.parentPath.type === 'ArrowFunctionExpression' && path.key === 'id',
						isNamedExportStatement: path.parentPath.type === 'ExportSpecifier',
						isVariableDeclarator: path.parentPath.type === 'VariableDeclarator' && path.key === 'id',
						isCallExpression: path.parentPath.type === 'CallExpression' && path.key === 'callee',
					}
					if (Object.values(exclude).find(isMatching => isMatching)) {
						return
					}
					logger('replaced', path.node.name, 'with', pointer.code, currentFile(state))
					moduleImportRemoversFor(state)[pointer.moduleName]?.()
					naiveStringReplace ? path.node.name = pointer.code : path.replaceWith(pointer.ast())
				}
			},
			CallExpression(path, state) {
				if (shouldSkipFile(state)) {
					return
				}
				const pointer = pointerMappingFor(state)[path.node.callee.name]
				if (pointer?.ast) {
					logger('replaced', path.node.callee.name, 'invocation with', pointer.code, currentFile(state))
					moduleImportRemoversFor(state)[pointer.moduleName]?.()
					naiveStringReplace ? path.node.callee.name = pointer.code : path.replaceWith(t.callExpression(pointer.ast(), path.node.arguments))
				}
			},
			ExportNamedDeclaration(path, state) {
				if (shouldSkipFile(state)) {
					return
				}

				for (const specifier of path.node.specifiers) {
					// find specifiers from import statements and replace with local variable declarations
					const pointer = pointerMappingFor(state)[specifier.local.name]
					if (pointer?.ast) {
						// use exported name so new multiple variable declarations of same imported namespace won't collide
						const newSpecifierLocalName = `__importToInlineRequirePlugin_exported_${specifier.exported.name}__${specifier.local.name}`

						const variableDeclaration = t.variableDeclaration('const', [
							t.variableDeclarator(t.identifier(newSpecifierLocalName), t.identifier(pointer.code))
						])
						const [newPath] = path.insertBefore(variableDeclaration)
						path.scope.registerDeclaration(newPath)

						specifier.local.name = newSpecifierLocalName
						moduleImportRemoversFor(state)[pointer.moduleName]?.()
						logger('replaced', specifier.local.name, 'export specifier with', newSpecifierLocalName, '=', pointer.code, currentFile(state))
					}
				}
			}
		},
	}
}

module.exports = ImportToInlineRequirePlugin
