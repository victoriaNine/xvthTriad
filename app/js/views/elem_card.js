define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "text!templates/templ_card.html"
], function Elem_Card ($, _, Backbone, _$, Templ_Card) {
    return Backbone.View.extend({
        tagName               : "div",
        className             : "card",

        template : _.template(Templ_Card),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {},

        initialize,
        flip
    });

    function initialize (attributes, options = {}) {
        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$el.html(this.template(this.model.attributes));
        this.$(".card-front").prepend(cardBG);

        if (_$.state.inGame) {
            this.deckIndex = _.isNil(attributes.deckIndex) ? -1 : attributes.deckIndex;

            if (options.checkOwner) {
                if (this.model.get("owner") === _$.state.game.get("players").user) {
                    this.$el.addClass("card-blue");
                } else {
                    this.$el.addClass("card-red");
                }
            } else {
                if (this.model.get("currentOwner") === _$.state.game.get("players").user) {
                    this.$el.addClass("card-blue");
                } else {
                    this.$el.addClass("card-red");
                }
            }
        } else {
            this.$el.addClass("card-black");
        }
    }

    function flip (info) {
        info = info || { from: "right" };
        _$.audio.audioEngine.playSFX("cardFlip");
        var tl = new TimelineMax();

        if (info.from === "top") {
            tl.to(this.$el, 0.4, { rotationX: -180 });
        } else if (info.from === "right") {
            tl.to(this.$el, 0.4, { rotationY: 180 });
        } else if (info.from === "bottom") {
            tl.to(this.$el, 0.4, { rotationX: 180 });
        } else if (info.from === "left") {
            tl.to(this.$el, 0.4, { rotationY: -180 });
        }

        tl.call(() => {
            this.$el.toggleClass("card-blue card-red");
        });

        if (info.from === "top") {
            tl.to(this.$el, 0.4, { rotationX: -360 });
        } else if (info.from === "right") {
            tl.to(this.$el, 0.4, { rotationY: 360 });
        } else if (info.from === "bottom") {
            tl.to(this.$el, 0.4, { rotationX: 360 });
        } else if (info.from === "left") {
            tl.to(this.$el, 0.4, { rotationY: -360 });
        }
    }
});
