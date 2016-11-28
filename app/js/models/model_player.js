define(["underscore", "backbone", "global", "collections/coll_deck"], function Model_Player (_, Backbone, _$, Coll_Deck) {
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
