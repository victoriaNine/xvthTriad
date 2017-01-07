module.exports = function (grunt, options) {
    return {
        server: {
            src: "<%= yeoman.tmp %>/js/global.js",
            dest: "<%= yeoman.tmp %>/js/global.js",
            options: {
              replacements: [
                {
                    pattern: "{{ VERSION }}",
                    replacement: "<%= pkg.version %>"
                },
                {
                    pattern: "{{ VERSION_NAME }}",
                    replacement: "<%= pkg.versionName %>"
                },
                {
                    pattern: "{{ VERSION_FLAG }}",
                    replacement: "<%= pkg.versionFlag %>"
                },
                {
                    pattern: "{{ DB_URL }}",
                    replacement: function () {
                        return "//" + process.env.DB_HOST;
                    }
                }
              ]
            }
        },
        build: {
            src: "<%= yeoman.app %>/js/global.js",
            dest: "<%= yeoman.dist %>/js/global.js",
            options: {
              replacements: [
                {
                    pattern: /debugMode\s*?:\s*?.*\,/ig,
                    replacement: "debugMode: false,"
                },
                {
                    pattern: "{{ VERSION }}",
                    replacement: "<%= pkg.version %>"
                },
                {
                    pattern: "{{ VERSION_NAME }}",
                    replacement: "<%= pkg.versionName %>"
                },
                {
                    pattern: "{{ VERSION_FLAG }}",
                    replacement: "<%= pkg.versionFlag %>"
                },
                {
                    pattern: "{{ DB_URL }}",
                    replacement: function () {
                        return "//" + process.env.DB_HOST;
                    }
                }
              ]
            }
        }
    };
};
