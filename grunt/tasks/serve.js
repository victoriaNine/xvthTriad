module.exports = function (grunt, options) {
  grunt.registerTask("serve", function (target) {
    if (target === "prod" || target === "beta") {
        return grunt.task.run([
            "setupEnv:prod",
            "connect:" + target,
            "keepalive"
        ]);
    }

    if (target === "dist") {
        return grunt.task.run([
            "clean:tmp",
            "copy:dist",
            "setupEnv:prod",
            "open:server",
            "connect:dist",
            "keepalive"
        ]);
    }

    var defaultTasks = [
        "clean:tmp",
        "sass:server",
        "buildImgLoaders",
        "copy:server",
        "setupEnv:server",
        "string-replace:server",
        "connect:livereload",
        //"open:server",
        "watch"
    ];

    if (target === "justConnect") {
        defaultTasks = defaultTasks.slice(-4);
    }

    grunt.task.run(defaultTasks);
  });

  grunt.registerTask("server", function (target) {
        grunt.log.warn("The `server` task has been deprecated. Use `grunt serve` to start a server.");
        grunt.task.run(["serve" + (target ? ":" + target : "")]);
    });
};
