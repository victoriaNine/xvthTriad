define(["underscore", "backbone", "global"], function Model_AI (_, Backbone, _$) {
    return Backbone.Model.extend({
        defaults : {
            game           : null,
            level          : "medium",
            bestActionRate : 66
        },

        initialize,
        doAction,
        getState,
        getPossibleActions,
        simulateActionOutcome
    });

    function initialize (options) {
        this.players              = null;
        this.currentState         = null;

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
    }

    function doAction () {
        this.players         = this.get("game").get("players");

        //console.log("=================");
        this.currentState    = this.getState(null, true);
        //console.log("--- SIMULATION");
        this.simulateActionOutcome(this.currentState.possibleActions[0], this.currentState);
    }

    function getState (currentState, fromCurrentGame) {
        var source = {};
        var state  = {};

        if (fromCurrentGame) {
            source.user        = this.players.user;
            source.computer    = this.players.opponent;
            source.board       = this.get("game").get("board");
            source.playing     = this.get("game").get("playing");
            source.playedCards = this.get("game").get("playedCards");
        } else {
            source.user        = currentState.user;
            source.computer    = currentState.computer;
            source.board       = currentState.board;
            source.playing     = currentState.playing;
            source.playedCards = currentState.playedCards;
        }

        state.user     = source.user.clone();
        state.computer = source.computer.clone();
        state.board    = _.clone(source.board);

        if (source.playing === this.players.user) {
            state.playing = state.user;
        } else {
            state.playing = state.computer;
        }

        state.playedCards = _.map(source.playedCards, function (card) {
            return card.clone();
        });

        // Is the game finished (or are we moving to a next turn)?
        state.endGame         = false;
        // Points earned by the computer since the root of the simulation tree
        state.totalPoints     = fromCurrentGame ? 0 : source.totalPoints;
        // List of possible actions for the current player at the start of the turn
        state.possibleActions = fromCurrentGame ? this.getPossibleActions(state) : currentState.possibleActions;

        return state;
    }

    function getPossibleActions (state) {
        var possibleActions    = [];
        var availableCards     = _.reject(state.playing.get("deck"), "attributes.position");
        var availableCases     = _.omitBy(state.board);
        var availablePositions = _.map(availableCases, function (boardCase, caseName) {
            return _$.utils.getPositionFromCaseName(caseName);
        });

        for (var i = 0, ii = availableCards.length; i < ii; i++) {
            for (var j = 0, jj = availablePositions.length; j < jj; j++) {
                possibleActions.push({
                    card          : availableCards[i].clone(),
                    position      : availablePositions[j],
                    outcomePoints : 0,
                    outcomeState  : null
                });

                //console.log(action.card.get("deckIndex"), action.card.get("name"), action.position);
            }
        }

        return possibleActions;
    }

    function simulateActionOutcome (action, currentState) {
        var that                 = this;
        // Copy the reference to the current state so other simulations can be performed on it
        var currentStateCopy      = this.getState(currentState);
        var currentComputerPoints = currentStateCopy.computer.get("points");
        var currentUserPoints     = currentStateCopy.user.get("points");
        var result;

        this.get("game").placeCard(action.card, action.position, currentStateCopy, function (outcomeState) {
            var isComputerTurn = (outcomeState.playing === outcomeState.computer);

            // We calculate the points gained or lost by the computer at the end of the turn
            action.outcomePoints      = outcomeState.computer.get("points") - currentComputerPoints;
            // And substract the points gained or lost by the user
            action.outcomePoints     -= outcomeState.user.get("points") - currentUserPoints;
            // The card bonus points are positive if the computer was playing, negative if it was the user's turn
            action.outcomePoints     += isComputerTurn ? action.card.get("bonus") : -1 * action.card.get("bonus");
            outcomeState.totalPoints += action.outcomePoints;
            action.outcomeState       = outcomeState;
            
            if (!action.outcomeState.endGame) {
                // We set the player who should play next
                if (isComputerTurn) {
                    action.outcomeState.playing = action.outcomeState.user;
                } else {
                    action.outcomeState.playing = action.outcomeState.computer;
                }

                // List of possible actions for the new player
                action.outcomeState.possibleActions = that.getPossibleActions(action.outcomeState);

                //that.simulateActionOutcome(action.outcomeState);
            }

            //console.log(action);
        });
    }
});
