define([
    "underscore", 
    "backbone",
    "global",
    "models/model_card"
], function Coll_Album (_, Backbone, _$, Model_Card) {
    return Backbone.Collection.extend({
        model      : Model_Card,
        comparator : "cardId",

        initialize
    });

    function initialize (cards, options) {
        var randomCards = _$.utils.getRandomCards({ amount: 7, level: 1, unique: true });
        if (!cards) {
            this.reset(randomCards, _.extend({ silent: true }, options));
        }
    }
});
