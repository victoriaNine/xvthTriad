module.exports = function (grunt, options) {
    grunt.registerTask("build", [
        "clean:wipe",
        "sass:server",
        "buildCardImgLoader",
        "copy:build",
        "cssmin",
        "string-replace:build",
        "requirejs",
        "babel",
        "uglify",
        "usemin",
        "clean:buildCleanup"
    ]);
};
