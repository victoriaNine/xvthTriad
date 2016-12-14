define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "text!templates/templ_endGameCard.html",
    "views/elem_card",
    "tweenMax"
], function Elem_EndGameCard ($, _, Backbone, _$, Templ_EndGameCard, Elem_Card) {
    return Backbone.View.extend({
        tagName               : "li",
        className             : "game_overlay-endGame-album-card",

        template : _.template(Templ_EndGameCard),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .card"  : function (e) {}
        },

        initialize
    });

    function initialize (options) {
        this.cardView = new Elem_Card({ model: options.card }, { checkOwner: true });

        this.$el.html(this.template({
            name: this.cardView.model.get("name")
        }));

        this.$(".game_overlay-endGame-album-card-visual").append(this.cardView.$el);
    }
});
