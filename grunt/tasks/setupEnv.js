module.exports = function (grunt, options) {
    var shell = require("shelljs");

    grunt.registerTask("setupEnv", function (target) {
        var env  = grunt.file.read("./env.sh");
        var cmds = env.match(/^(set|export)\s(.*?)=(.*?)$/gm);
        var cmd;

        shell.env["NODE_ENV"] = target;
        for (var i = 0, ii = cmds.length; i < ii; i++) {
            cmd = cmds[i].match(/(?:set|export)\s(.*?)=(.*?)$/);
            shell.env[cmd[1]] = cmd[2];
        }
    });
};
