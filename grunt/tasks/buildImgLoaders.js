module.exports = function (grunt, options) {
    var _ = require("lodash");

    grunt.registerTask("buildImgLoaders", function (target) {
        // Cards
        var cardList     = grunt.file.readJSON(grunt.config("yeoman").app + "/js/data/cardList.json");
        var cardFileList = _.map(cardList, function (card) {
            return {
                "type" : "img.cards",
                "name" : _.camelCase(card.name) + ".png"
            };
        });

        var cardsImgLoader = {
            "name"  : "imgCards",
            "files" : cardFileList
        };

        grunt.file.write(grunt.config("yeoman").app + "/js/data/loader_imgCards.json", JSON.stringify(cardsImgLoader, null, "\t")); 

        // Flags
        var countryList     = grunt.file.readJSON(grunt.config("yeoman").app + "/js/data/countryList.json");
        var countryFileList = [];

        _.each(countryList, function (country) {
            countryFileList.push({
                "type" : "img.flags",
                "name" : "4x3/" + _.lowerCase(country.code) + ".svg"
            });
        });

        var flagsImgLoader = {
            "name"  : "imgFlags",
            "files" : countryFileList
        };

        grunt.file.write(grunt.config("yeoman").app + "/js/data/loader_imgFlags.json", JSON.stringify(flagsImgLoader, null, "\t")); 
    });
};
