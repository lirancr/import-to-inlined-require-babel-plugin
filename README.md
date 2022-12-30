[![Run tests](https://github.com/lirancr/import-to-inlined-require-babel-plugin/actions/workflows/test.yml/badge.svg)](https://github.com/lirancr/import-to-inlined-require-babel-plugin/actions/workflows/test.yml)
[![NPM Version](https://badge.fury.io/js/import-to-inlined-require-babel-plugin.svg?style=flat)](https://www.npmjs.com/package/import-to-inlined-require-babel-plugin)

# Import to Inline Require - babel plugin

Used to converted import statements into an inline require statements. 
Useful when trying to avoid requiring modules that are eventually unused in a particular code path and without using a bundler for tree shaking.

By converting each import statement into it's inlined require statement equivalent your code load only the necessary modules for it's runtime operation.

For example if plugin is applied to the code:
```javascript
import { mapKeys } from 'lodash'

let myObj = {...}
if (someCondition) {
    myObj = mapKeys(myObj, (v, k) => v)
}
```

the output will be
```javascript

let myObj = {...}
if (someCondition) {
    myObj = require('lodash').mapKeys(myObj, (v, k) => v)
}
```

and so `lodash` module will not be loaded unless `someCondition` is actually true.

### conversion examples

1. namespace imports
    ```javascript
    import { namespace } from 'module'
    
    const value = namespace
    ```
    
    ```javascript
    const value = require('module').namespace
    ```

2. renamed namespace imports
    ```javascript
    import { namespace as somethingElse } from 'module'
    
    const value = namespace
    ```

    ```javascript
    const value = require('module').namespace
    ```

3. all namespaces imports
    ```javascript
    import * as allNamespace from 'module'
    
    const value = allNamespace
    ```
    
    ```javascript
    const value = require('module')
    ```

4. default import
    ```javascript
    import allNamespace from 'module'
    
    const value = allNamespace
    ```

    ```javascript
    const value = require('module').default
    ```

### Configuration options

| name               | type                 | default | description                                                             |
|--------------------|----------------------|---------|-------------------------------------------------------------------------|
| verbose            | Boolean              | false   | Toggle verbose logging                                                  |
| excludeFiles       | Array<String/RegExp> | [ ]     | Skip replacing import statements in certain files                       |
| excludeModules     | Array<String/RegExp> | [ ]     | Skip replacing import statements of certain modules in all files        |
| naiveStringReplace | Boolean              | false   | Use string literal value when modifying code instead of using AST nodes |
