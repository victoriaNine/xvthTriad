module.exports = function (grunt, options) {
    return {
        dist: {
            // Options: https://github.com/jrburke/r.js/blob/master/build/example.build.js
            options: {
                almond: true,

                replaceRequireScript: [{
                    files: ["<%= yeoman.dist %>/index.html"],
                    module: "main"
                }],

                modules: [{name: "main"}],
                baseUrl: "<%= yeoman.dist %>/js",

                mainConfigFile: "<%= yeoman.dist %>/js/main.js", // contains path specifications and nothing else important with respect to config

                keepBuildDir: true,
                dir: "<%= yeoman.dist %>/js",

                optimize: "none", // optimize by uglify task
                useStrict: false,
                wrap: true,
                allowSourceOverwrites: true
            }
        }
    };
};
