define([
    "underscore", 
    "backbone",
    "global",
    "models/model_card"
], function Coll_Album (_, Backbone, _$, Model_Card) {
    return Backbone.Collection.extend({
        model: Model_Card,

        initialize
    });

    function initialize () {
        this.reset(_$.utils.getRandomCards({ amount: 7, level: 1, unique: true }));
    }
});
