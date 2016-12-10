define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "text!templates/templ_card.html",
    "tweenMax"
], function Elem_Card ($, _, Backbone, _$, Templ_Card) {
    return Backbone.View.extend({
        tagName               : "div",
        className             : "card",

        template : _.template(Templ_Card),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {},

        initialize
    });

    function initialize (attributes, options) {
        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$el.html(this.template(this.model.attributes));
        this.$(".card-front").prepend(cardBG);

        if (_$.state.inGame) {
            this.deckIndex = attributes.deckIndex;

            if (this.model.currentOwner === _$.state.game.get("players").user) {
                this.$el.addClass("card-blue");
            } else {
                this.$el.addClass("card-red");
            }
        } else {
            this.$el.addClass("card-black");
        }
    }
});
