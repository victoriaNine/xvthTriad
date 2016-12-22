define(["underscore", "backbone", "global"], function Model_Player (_, Backbone, _$) {
    return Backbone.Model.extend({
        defaults : {
            type   : "computer",
            user   : null,
            name   : null,
            avatar : null,
            deck   : null,
            points : 5,
            AI     : null
        },

        playTurn
    });

    function playTurn () {
        if (this.get("AI")) {
            this.get("AI").doAction();
        }
    }
});
