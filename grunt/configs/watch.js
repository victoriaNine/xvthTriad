module.exports = function (grunt, options) {
    return {
        sass: {
            files: ["<%= yeoman.app %>/css/{,*/}*.scss"],
            tasks: ["newer:sass:server","newer:copy:server"]
        },
        livereload: {
            options: {
                nospawn: true,
                livereload: grunt.option("livereloadport") || "<%= livereloadPort %>"
            },
            files: [
                "<%= yeoman.app %>/*.html",
                "<%= yeoman.app %>/css/{,*/}*.css",
                "<%= yeoman.app %>/js/{,*/}*.{js,json}",
                "<%= yeoman.app %>/assets/img/{,*/}*.{png,jpg,jpeg,gif,webp}",
                "<%= yeoman.app %>/assets/svg/{,*/}*.svg",
                "<%= yeoman.app %>/js/templates/*.{html,ejs,mustache,hbs}"
            ],
            tasks: ["newer:copy:server","newer:string-replace:server"]
        }
    };
};
