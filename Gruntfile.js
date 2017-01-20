process.on("uncaughtException", function (error) {
    console.trace(error);
    console.trace(error.stack);
});

var path  = require("path");

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to match all subfolders:
// 'test/spec/**/*.js'
// templateFramework: 'lodash'

module.exports = function (grunt, options) {
    grunt.option("stack", true);
    grunt.loadNpmTasks("grunt-keepalive");

    // Automatically load required Grunt tasks
    require("load-grunt-tasks")(grunt);

    // show elapsed time at the end
    require("time-grunt")(grunt);

    // configurable paths
    var pkgFile      = grunt.file.readJSON("package.json");
    var yeomanConfig = {
        app  : "app",
        dist : "dist",
        tmp  : ".tmp",
        beta : "beta",
        prod : "html"
    };

    require("load-grunt-config")(grunt, {
        configPath : path.join(process.cwd(), "grunt/configs"),
        init       : true,
        data       : {
            pkg            : pkgFile,
            yeoman         : yeomanConfig,
            hostname       : "localhost",
            serverPort     : 9000,
            livereloadPort : 35729
        }
    });

    grunt.loadTasks(path.join(process.cwd(), "grunt/tasks"));
    grunt.registerTask("default", ["serve"]);
};
