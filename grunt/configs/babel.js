module.exports = function (grunt, options) {
    return {
        options: {
            sourceMap: true,
            presets: ["es2015"]
        },
        dist: {
              files: {
                  "<%= yeoman.dist %>/js/build.js": "<%= yeoman.dist %>/js/main.js"
              }
        }
    };
};
