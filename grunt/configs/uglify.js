module.exports = function (grunt, options) {
    return {
        options: {
            sourceMap: true
        },
        dist: {
            files: {
                "<%= yeoman.dist %>/js/build.min.js": [
                    "<%= yeoman.dist %>/js/build.js"
                ]
            }
        }
    };
};
