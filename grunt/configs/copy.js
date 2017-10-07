module.exports = function (grunt, options) {
    return {
        server: {
            expand: true,
            dot: true,
            cwd: "<%= yeoman.app %>",
            src: ["**"],
            dest: "<%= yeoman.tmp %>"
        },
        dist: {
            expand: true,
            dot: true,
            cwd: "<%= yeoman.dist %>",
            dest: "<%= yeoman.tmp %>",
            src: ["**"]
        },
        build: {
            files: [
                {
                    expand: true,
                    dot: true,
                    cwd: "<%= yeoman.app %>",
                    src: ["**", "!css/**"],
                    dest: "<%= yeoman.dist %>"
                }/*,
                {
                    src: "node_modules/apache-server-configs/dist/.htaccess",
                    dest: "<%= yeoman.dist %>/.htaccess"
                }*/
            ]
        }
    };
};
