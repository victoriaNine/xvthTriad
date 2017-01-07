module.exports = function (grunt, options) {
    return {
        wipe         : ["<%= yeoman.tmp %>", "<%= yeoman.dist %>"],
        buildCleanup : ["<%= yeoman.dist %>/js/*", "!<%= yeoman.dist %>/js/build.min.js*"],
        tmp          : "<%= yeoman.tmp %>",
        dist         : "<%= yeoman.dist %>"
    };
};
