define([
    "underscore",
    "backbone",
    "global",
    "models/model_player",
    "models/model_board",
    "collections/coll_deck"
], function Model_Game (_, Backbone, _$, Player, Board, Deck) {
    return Backbone.Model.extend({
        defaults : {
            type    : "solo",
            level   : "easy",
            rules   : getRules(),
            board   : null,
            players : {}
        },

        initialize        : initialize,
        setupComputerInfo : setupComputerInfo,
        buildRandomDeck   : buildRandomDeck
    });

    function initialize (attributes, options) {
        this.user     = attributes.user;
        var userDeck  = this.buildRandomDeck(this.user); // move logic to view
        var gameLevel = this.get("level");

        if (!attributes.type || attributes.type === "solo") {
            var computerInfo = this.setupComputerInfo();

            this.set({ players :
                {
                    user     : new Player({ type: "human", user: this.user, name: this.user.get("name"), avatar: this.user.get("avatar"), deck: userDeck }),
                    opponent : new Player({ type: "computer", user: null, name: computerInfo.name, avatar: computerInfo.avatar, deck: computerInfo.deck })
                }
            });
        }

        this.set({ board : new Board() });
    }

    function setupComputerInfo () {
        var info = {};
        var cardMaxLevel;

        switch (this.get("level")) {
            case "easy":
                info.name    = "Moomba Computer";
                info.avatar  = "./assets/img/avatars/computer_moomba.jpg";
                cardMaxLevel = 3;
                break;
            case "medium":
                info.name    = "CC Jack Computer";
                info.avatar  = "./assets/img/avatars/computer_jack.jpg";
                cardMaxLevel = 7;
                break;
            case "hard":
                info.name    = "Queen of Cards Computer";
                info.avatar  = "./assets/img/avatars/computer_queen.jpg";
                cardMaxLevel = 10;
                break;
        }

        info.deck = new Deck(_$.utils.getRandomCards({
            amount   : 5,
            minLevel : 1,
            maxLevel : 1,//cardMaxLevel,
            owner    : null
        }));

        return info;
    }

    function buildRandomDeck (user) {
        return new Deck(_$.utils.getRandomCards({
            amount     : 5,
            album : user.get("album")
        }));
    }

    function getRules (rules) {
        if (rules && !rules.trade.match("none|one|difference|direct|all")) {
            throw new Error("Invalid trade rule: " + rules.trade);
        }

        return _.defaults({
            open        : true,
            random      : false,
            same        : false,
            sameWall    : false,
            plus        : false,
            elemental   : false,
            suddenDeath : false,
            trade       : "none"
        }, rules);
    }
});
