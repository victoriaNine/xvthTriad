define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/elem_card",
    "text!templates/templ_endGameCard.ejs"
], function Elem_EndGameCard ($, _, Backbone, _$, Elem_Card, Templ_EndGameCard) {
    return Backbone.View.extend({
        tagName   : "li",
        className : "game_overlay-endGame-album-card",
        template  : _.template(Templ_EndGameCard),
        events    : {
            "mouseenter .card-red" : function (e) {
                _$.audio.audioEngine.playSFX("cardSort");
                TweenMax.set(e.currentTarget, { scale: "1.1" });
            },
            "mouseleave .card-red" : function (e) { TweenMax.set(e.currentTarget, { scale: "1" }); },
            "click .card"          : "selectCard"
        },

        initialize,
        selectCard
    });

    function initialize (options) {
        this.selected  = false;
        this.deckIndex = options.deckIndex;
        this.cardView  = new Elem_Card({ model: options.card }, { checkOwner: true });

        this.$el.html(this.template({
            name: this.cardView.model.get("name")
        }));

        this.$(".game_overlay-endGame-album-card-visual").append(this.cardView.$el);

        if (!_$.state.game.get("cardsToTrade") ||
            _$.state.game.get("winner") !== _$.state.game.get("players").user ||
            this.cardView.model.get("owner") !== _$.state.game.get("players").opponent) {
            this.events = {};
            TweenMax.set(this.$el, { pointerEvents: "none" });
            this.undelegateEvents();
        }
    }

    function selectCard (event, removingExcess) {
        this.selected = !this.selected;

        var tl = new TimelineMax({ delay: removingExcess ? 0.15 : 0 });
        tl.set(this.$(".card"), { scale: "1" });
        tl.add(this.cardView.flip());

        if (!removingExcess) {
            _$.events.trigger("endGameCardSelected", { endGameCardView: this, selected: this.selected });
        }
    }
});
