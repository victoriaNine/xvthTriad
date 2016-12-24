define(["underscore", "backbone", "global"], function Model_AI (_, Backbone, _$) {
    return Backbone.Model.extend({
        defaults : {
            game           : null,
            level          : "medium",
            bestActionRate : 75
        },

        initialize,
        doAction,
        getSimulationDepth,
        getState,
        getPossibleActions,
        tryActions,
        simulateActionOutcome,
        findBestAction,
        randomizeAction
    });

    function initialize (options) {
        this.turnNumber   = -1;
        this.currentState = null;
        this.bestAction   = null;
        this.action       = null;
        this.maxDepth     = 0;

        switch (this.get("level")) {
            case "easy":
                this.set("bestActionRate", 100);
                break;
            case "medium":
                this.set("bestActionRate", 75);
                break;
            case "hard":
                this.set("bestActionRate", 100);
                break;
        }
    }

    function doAction () {
        this.turnNumber++;
        this.currentState = this.getState(null, true);

        if (this.currentState.possibleActions.length === 1) {
            this.bestAction = this.currentState.possibleActions[0];
            this.action     = this.bestAction;
        } else {
            this.maxDepth = this.getSimulationDepth();

            this.tryActions(this.currentState.possibleActions, this.currentState);
            this.bestAction = this.findBestAction(this.currentState.possibleActions);
            this.action     = this.randomizeAction();
        }

        console.log("bestAction", this.bestAction);
        console.log("action", this.action);

        return this.action;
    }

    function getSimulationDepth () {
        switch (this.get("level")) {
            case "easy":
                return 0;
            case "medium":
                if (this.turnNumber === 0) {
                    return 1;
                } else {
                    return 2;
                }
                break;
            case "hard":
                if (this.turnNumber === 0) {
                    return 1;
                } else {
                    return this.turnNumber + 1;
                }
                break;
        }
    }

    function getState (currentState, fromCurrentGame) {
        var source = {};
        var state  = {};

        if (fromCurrentGame) {
            source.user        = this.get("game").get("players").user;
            source.computer    = this.get("game").get("players").opponent;
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

        if (source.playing === source.user) {
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
        state.totalPoints     = fromCurrentGame ? 0 : currentState.totalPoints;
        // List of possible actions for the current player at the start of the turn
        state.possibleActions = fromCurrentGame ? this.getPossibleActions(state, 0) : currentState.possibleActions;

        return state;
    }

    function getPossibleActions (state, depth) {
        var possibleActions    = [];
        var availableCards     = _.reject(state.playing.get("deck"), "attributes.position");
        var availableCases     = _.omitBy(state.board);
        var availablePositions = _.map(availableCases, function (boardCase, caseName) {
            return _$.utils.getPositionFromCaseName(caseName);
        });

        var i, ii, j, jj;

        for (i = 0, ii = availableCards.length; i < ii; i++) {
            for (j = 0, jj = availablePositions.length; j < jj; j++) {
                possibleActions.push({
                    id            : "depth" + depth + ".card" + i + ".pos" + j,
                    depth         : depth,
                    card          : availableCards[i].clone(),
                    position      : availablePositions[j],
                    outcomePoints : 0,
                    outcomeState  : null
                });
            }
        }

        return possibleActions.length ? possibleActions : null;
    }

    function tryActions (possibleActions, state) {
        for (var i = 0, ii = possibleActions.length; i < ii; i++) {
            this.simulateActionOutcome(possibleActions[i], state);
        }
    }

    function simulateActionOutcome (action, currentState) {
        var that                  = this;
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
            
            if (!action.outcomeState.endGame && (that.maxDepth === -1 || action.depth < that.maxDepth)) {
                // We set the player who should play next
                if (isComputerTurn) {
                    action.outcomeState.playing = action.outcomeState.user;
                } else {
                    action.outcomeState.playing = action.outcomeState.computer;
                }

                // List of possible actions for the new player
                action.outcomeState.possibleActions = that.getPossibleActions(action.outcomeState, action.depth + 1);
                that.tryActions(action.outcomeState.possibleActions, action.outcomeState);
            } else {
                action.outcomeState.possibleActions = null;
            }
        });
    }

    function findBestAction (possibleActions) {
        var pointsPerInitialAction = [];
        var maxPointsIndex = -1;
        var possibleAction;

        for (var i = 0, ii = possibleActions.length; i < ii; i++) {
            console.log("=======");
            possibleAction            = possibleActions[i];
            pointsPerInitialAction[i] = findBestOutcomePoints(possibleAction.outcomeState);
        }

        maxPointsIndex = _.indexOf(pointsPerInitialAction, _.max(pointsPerInitialAction));

        return possibleActions[maxPointsIndex];
    }

    function findBestOutcomePoints (rootState) {
        var endGameOutcomePoints = [];
        var action;
        var i, ii;

        function recurse (currentState) {
            for (i = 0, ii = currentState.possibleActions.length; i < ii; i++) {
                action = currentState.possibleActions[i];
                console.log(action.id, action.card.get("deckIndex"), action.card.get("name"), action.position, action.outcomePoints);

                if (action.outcomeState.possibleActions) {
                    recurse(action.outcomeState);
                } else {
                    console.log("== possible end action:", action, action.outcomeState.totalPoints);
                    endGameOutcomePoints.push(action.outcomeState.totalPoints);
                }
            }
        }

        if (!rootState.possibleActions) {
            return rootState.totalPoints;
        }

        recurse(rootState);
        return _.max(endGameOutcomePoints);
    }

    function randomizeAction () {
        if (this.get("bestActionRate") === 100 || Math.random() < this.get("bestActionRate") / 100) {
            return this.bestAction;
        } else {
            return _.sample(this.currentState.possibleActions);
        }
    }
});
