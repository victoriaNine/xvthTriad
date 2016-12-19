/*
**  Aggregation -- Aggregation of Base Class and Mixin Classes
**  Copyright (c) 2015 Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/* global module: true */
module.exports = function (grunt) {
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-exec");

    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: "jshint.json"
            },
            "gruntfile":   [ "Gruntfile.js" ],
            "aggregation": [ "src/**/*.js", "tst/**/*.js" ]
        },
        exec: {
            "aggregation-es5": {
                cmd: "node tst/aggregation-es5.js"
            },
            "aggregation-es6": {
                cmd: "./node_modules/.bin/babel-node --presets es2015 tst/aggregation-es6.js"
            }
        },
        clean: {
            clean:     [ ],
            distclean: [ "node_modules" ]
        }
    });

    grunt.registerTask("default", [ "jshint", "exec" ]);
};
