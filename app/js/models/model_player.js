define(["underscore", "backbone", "global", "collections/Coll_deck"], function Model_Player (_, Backbone, _$, Deck) {
    return Backbone.Model.extend({
        defaults : {
            type   : "computer",
            user   : null,
            name   : null,
            avatar : null,
            deck   : null,
            points : 5
        },

        initialize: initialize
    });

    function initialize () {
    }
});
