module.exports = function (grunt, options) {
    grunt.registerTask("build", [
        "clean:wipe",
        "sass:server",
        "buildImgLoaders",
        "copy:build",
        "cssmin",
        "setupEnv:prod",
        "string-replace:build",
        "requirejs",
        "babel",
        "uglify",
        "usemin",
        "clean:buildCleanup"
    ]);
};
