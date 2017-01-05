module.exports = function (grunt, options) {
    grunt.registerTask("build", [
        "clean:buildPre",
        "sass:server",
        "buildCardImgLoader",
        "copy:build",
        "cssmin",
        "string-replace:build",
        "requirejs",
        "babel",
        "uglify",
        "usemin",
        "clean:buildPost"
    ]);
};
