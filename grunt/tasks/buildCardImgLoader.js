module.exports = function (grunt, options) {
    var _ = require("lodash");

    grunt.registerTask("buildCardImgLoader", function (target) {
        var cardList = grunt.file.readJSON(grunt.config("yeoman").app + "/js/data/cardList.json");
        var fileList = _.map(cardList, function (card) {
            return {
                "type" : "img.cards",
                "name" : _.camelCase(card.name) + ".png"
            };
        });

        var cardImgLoader = {
            "name"  : "imgCards",
            "files" : fileList
        };

        grunt.file.write(grunt.config("yeoman").app + "/js/data/loader_imgCards.json", JSON.stringify(cardImgLoader, null, "\t")); 
    });
};
