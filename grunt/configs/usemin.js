module.exports = function (grunt, options) {
    return {
        html: ["<%= yeoman.dist %>/{,*/}*.html"],
        options: {
            dirs: ["<%= yeoman.dist %>"],
            blockReplacements: {
                base: function (block) {
                    return ['<base href="', block.dest, '">'].join("");
                }
            }
        }
    };
};
