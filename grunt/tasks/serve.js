module.exports = function (grunt, options) {
  grunt.registerTask("serve", function (target) {
    if (target === "prod" || target === "beta") {
        return grunt.task.run([
            "setupEnv:prod",
            "connect:" + target + ":keepalive"
        ]);
    }

    if (target === "dist") {
        return grunt.task.run([
            "clean:server",
            "copy:dist",
            "open:server",
            "setupEnv:prod",
            "connect:dist:keepalive"
        ]);
    }

    var defaultTasks = [
        "clean:server",
        "sass:server",
        "buildCardImgLoader",
        "copy:server",
        "string-replace:server",
        "setupEnv:server",
        "connect:livereload",
        //"open:server",
        "watch"
    ];

    if (target === "justConnect") {
        defaultTasks = defaultTasks.slice(-3);
    }

    grunt.task.run(defaultTasks);
  });

  grunt.registerTask("server", function (target) {
        grunt.log.warn("The `server` task has been deprecated. Use `grunt serve` to start a server.");
        grunt.task.run(["serve" + (target ? ":" + target : "")]);
    });
};
