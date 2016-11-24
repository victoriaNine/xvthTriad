define([
    "jquery",
    "underscore", 
    "backbone",
    "gsap",
    "global",
    "text!templates/templ_card.html"
], function Elem_Card ($, _, Backbone, GSAP, _$, Templ_Card) {
    return Backbone.View.extend({
        tagName               : "div",
        className             : "card",

        template : _.template(Templ_Card),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
        },

        initialize       : initialize,
        render           : render,
        placeCard        : placeCard
    });

    function initialize (options) {
        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$el.append(this.template(this.model.attributes));
        this.$(".card-front").prepend(cardBG);

        if (_$.state.inGame) {
            this.deckIndex = options.deckIndex;
            this.played    = false;

            if (this.model.get("currentOwner") === _$.state.user) {
                this.$el.addClass("card-blue");
                this._placeOnHolder = function () { return this.placeCard("user", "holder"); };
            } else {
                this.$el.addClass("card-red");
                this._placeOnHolder = function () { return this.placeCard("opponent", "holder"); };
            }
        } else {
            this.$el.addClass("card-black");
        }
    }

    function render () {
        if (_$.state.inGame) {
            if (this.played) {
                // replace on board
            } else {
                this._placeOnHolder();
            }
        }
        
        return this;
    }

    function placeCard (player, where) {
        var destination;

        if (where === "holder") {
            destination = $(".playerHUD." + player).find(".cardHolder").eq(this.deckIndex);
        } else if (where === "board") {
            // place on board logic
        }

        var coords = _$.utils.getDestinationCoord(this.$el, destination, { player: player, halfWidth: (this.deckIndex > 0) });
        TweenMax.set(this.$el, {x: coords.left, y: coords.top});
    }
});
