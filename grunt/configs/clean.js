module.exports = function (grunt, options) {
    return {
        buildPre  : ["<%= yeoman.tmp %>", "<%= yeoman.dist %>"],
        buildPost : ["<%= yeoman.dist %>/js/*", "!<%= yeoman.dist %>/js/build.min.js*"],
        server    : "<%= yeoman.tmp %>",
        build     : "<%= yeoman.dist %>"
    };
};
