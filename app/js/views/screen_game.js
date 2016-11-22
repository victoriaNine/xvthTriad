define([
    "jquery",
    "underscore", 
    "backbone",
    "gsap",
    "global",
    "text!templates/templ_game.html",
    "views/elem_card"
], function Screen_Game ($, _, Backbone, GSAP, _$, Templ_Game, Elem_Card) {
    var events = _$.events;

    return Backbone.View.extend({
        tagName   : "section",
        className : "screen",
        id        : "screen_game",

        template : _.template(Templ_Game),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            //"click #mainMenu .newGame" : "newGame"
        },

        initialize       : initialize,
        remove           : remove,
        render           : render,
        renderCard       : renderCard,
        onResize         : onResize
    });

    function initialize (options) {
        _$.state.inGame = true;
        this.$el.html(this.template());

        this.players = this.model.get("players");

        this.ui              = {};
        this.ui.board        = this.$("#board");
        this.ui.cardsWrapper = this.$("#cardsWrapper");
        this.ui.HUDuser      = this.$(".playerHUD-user");
        this.ui.HUDopponent  = this.$(".playerHUD-opponent");

        this.subviews        = {};
        this.subviews.cards  = [];

        _$.utils.addDomObserver(this.subviews.cards, "cardAppended", true);

        events.on("cardAppended", function (event, card) {
            card._placeOnHolder();
        });

        this.players.user.get("deck").each(renderCard.bind(this), this);
        this.players.opponent.get("deck").each(renderCard.bind(this), this);

        $(window).on("resize." + _$.appName, this.onResize.bind(this));
        this.render();
    }

    function remove () {
        $(window).off("resize." + _$.appName);
        Backbone.View.prototype.remove.call(this);
    }

    function render () {
        this.ui.HUDuser.find(".playerHUD-bar").html(this.players.user.get("name"));
        this.ui.HUDopponent.find(".playerHUD-bar").html(this.players.opponent.get("name"));
        this.ui.HUDuser.find(".playerHUD-score").html(this.players.user.get("points"));
        this.ui.HUDopponent.find(".playerHUD-score").html(this.players.opponent.get("points"));

        this.ui.HUDuser.find(".playerHUD-avatar img").attr("src", this.players.user.get("avatar"));
        this.ui.HUDopponent.find(".playerHUD-avatar img").attr("src", this.players.opponent.get("avatar"));

        return this;
    }

    function renderCard (card, index) {
        var cardElem = new Elem_Card({ model: card, inGame: true, user: this.model.user, deckIndex: index });
        this.ui.cardsWrapper.append(cardElem.el);
        this.subviews.cards.push(cardElem);
    }

    function onResize (event) {
        this.subviews.cards.forEach((cardElem) => {
            cardElem.render();
        });
    }

    /*function addDomObserver (once, eventName) {
        this._domObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                this.subviews.cards.forEach((cardElem) => {
                    if (mutation.addedNodes[0] === cardElem.el) {
                        cardElem._placeOnHolder();
                    }
                });
            });

            if (once) {
                this._domObserver.disconnect();
            }
        });
         
        this._domObserver.observe(this.$el[0], {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
            attributeOldValue: true,
            characterDataOldValue: true
        });
    }*/
});
