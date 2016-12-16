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
            "mouseenter .card-red" : function (e) { TweenMax.set(e.currentTarget, { scale: "1.1" }); },
            "mouseleave .card-red" : function (e) { TweenMax.set(e.currentTarget, { scale: "1" }); },
            "click .card"          : "selectCard"
        },

        initialize,
        selectCard
    });

    function initialize (options) {
        this.selected = false;
        this.cardView = new Elem_Card({ model: options.card }, { checkOwner: true });

        this.$el.html(this.template({
            name: this.cardView.model.get("name")
        }));

        this.$(".game_overlay-endGame-album-card-visual").append(this.cardView.$el);

        _$.utils.addDomObserver(this.$el, () => {
            if (!_$.state.game.cardsToTrade || _$.state.game.winner !== _$.state.game.get("players").user || this.cardView.model.owner !== _$.state.game.get("players").opponent) {
                this.undelegateEvents();
            }
        }, true);
    }

    function selectCard () {
        this.selected = !this.selected;
        TweenMax.set(this.$(".card"), { scale: "1" });
        this.cardView.flip();
        _$.events.trigger("endGameCardSelected", { endGameCardView: this, selected: this.selected });
    }
});