module.exports = function (grunt, options) {
    return {
        server: {
            path: "http://localhost:<%= serverPort %>"
        }
    };
};
