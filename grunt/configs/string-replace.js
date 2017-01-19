module.exports = function (grunt, options) {
    return {
        server: {
            src: "<%= yeoman.tmp %>/js/global.js",
            dest: "<%= yeoman.tmp %>/js/global.js",
            options: {
              replacements: [
                {
                    pattern: /{{ NAME }}/g,
                    replacement: "<%= pkg.name %>"
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
                    pattern: /{{ NAME }}/g,
                    replacement: "<%= pkg.name %>"
                },
                {
                    pattern: /debugMode\s*?:\s*?.*\,/g,
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
                }
              ]
            }
        }
    };
};
