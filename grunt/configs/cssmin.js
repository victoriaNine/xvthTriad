module.exports = function (grunt, options) {
    return {
        options: {
            sourceMap: true
        },
        dist: {
            files: {
                "<%= yeoman.dist %>/css/build.min.css": [
                    "<%= yeoman.app %>/css/main.css"
                ]
            }
        }
    };
};
