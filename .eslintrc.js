module.exports = {
    "parserOptions": {
        "ecmaVersion": 2017
    },
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "rules": {
        "indent": [
            "error",
            2,
            { "SwitchCase": 1 }
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always",
            {
                'omitLastInOneLineBlock': true,
            }
        ],
        'no-unused-vars': [
            "error",
            {
                "vars": "all",
                "args": "after-used",
                "ignoreRestSiblings": false,
                'varsIgnorePattern': '^_',
                'argsIgnorePattern': '^_',
            }
        ],
        "no-console": 'off',
    }
};
