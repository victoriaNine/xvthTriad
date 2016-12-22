define(["underscore", "backbone", "global"], function Model_AI (_, Backbone, _$) {
    return Backbone.Model.extend({
        defaults : {
            game           : null,
            level          : "easy",
            bestActionRate : 33
        },

        initialize,
        doAction,
        getSimulation,
        analyzeSimulation
    });

    function initialize (options) {
        this.players = null;

        switch (this.get("level")) {
            case "easy":
                this.set("bestActionRate", 33);
                break;
            case "medium":
                this.set("bestActionRate", 66);
                break;
            case "hard":
                this.set("bestActionRate", 100);
                break;
        }

        _$.events.on("outputSimulation", this.analyzeSimulation.bind(this));
    }

    function doAction () {
        console.log("doAction");
        this.players = this.get("game").get("players");

        var card       = this.players.opponent.get("deck")[0];
        var simulation = this.getSimulation(card);
        simulation.newCard.set("position", { x: 1, y: 1 });

        this.get("game").updateTurn(null, simulation);
    }

    function getSimulation (newCard) {
        var simulation      = {};
        simulation.newCard  = newCard.clone();
        simulation.user     = this.players.user.clone();
        simulation.computer = this.players.opponent.clone();

        if (this.get("game").playing === this.players.user) {
            simulation.playing = simulation.user;
        } else {
            simulation.playing = simulation.computer;
        }

        simulation.playedCards = _.map(this.get("game").playedCards, function (card) {
            return card.clone();
        });

        return simulation;
    }

    function analyzeSimulation (event, simulation) {
        console.log(simulation);
    }
});
