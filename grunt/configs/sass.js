module.exports = function (grunt, options) {
    return {
        options: {
            style: "nested",
            noCache: true
        },
        server: {
            files: {
                "<%= yeoman.app %>/css/main.css": "<%= yeoman.app %>/css/main.scss"
            }
        }
    };
};
