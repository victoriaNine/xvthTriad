import { clone, map, reject, omitBy, indexOf, max, sample, without } from 'lodash';
import Backbone from 'backbone';

import _$ from 'common';

export default Backbone.Model.extend({
  defaults : {
    game           : null,
    level          : "easy",
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

function initialize (options) { // eslint-disable-line no-unused-vars
  this.currentState = null;
  this.bestAction   = null;
  this.action       = null;
  this.maxDepth     = 0;

  switch (this.get("level")) {
    case "easy":
      this.set("bestActionRate", 100);
      break;
    case "normal":
      this.set("bestActionRate", 75);
      break;
    case "hard":
      this.set("bestActionRate", 100);
      break;
  }
}

function doAction () {
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

  return this.action;
}

function getSimulationDepth () {
  let turnNumber = this.get("game").get("turnNumber");

  if (turnNumber === 0 || this.get("level") === "easy") {
    return 0;
  }

  switch (this.get("level")) {
    case "normal":
      if (turnNumber === 1) {
        return 1;
      }
      return 2;
    case "hard":
      if (turnNumber === 1) {
        return 1;
      } else if (turnNumber === 2) {
        return 2;
      }
      return 3;
  }
}

function getState (currentState, fromCurrentGame) {
  const source = {};
  const state  = {};

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
  state.board    = clone(source.board);

  if (source.playing === source.user) {
    state.playing = state.user;
  } else {
    state.playing = state.computer;
  }

  state.playedCards = map(source.playedCards, (card) => {
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
  const possibleActions    = [];
  const availableCards     = reject(state.playing.get("deck"), "attributes.position");
  const availableCases     = omitBy(state.board);
  const availablePositions = map(availableCases, (boardCase, caseName) => {
    return _$.utils.getPositionFromCaseName(caseName);
  });

  let i, ii, j, jj;

  for (i = 0, ii = availableCards.length; i < ii; i++) {
    for (j = 0, jj = availablePositions.length; j < jj; j++) {
      possibleActions.push({
        id            : "depth" + depth + ".card" + i + ".pos" + j,
        depth,
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
  for (let i = 0, ii = possibleActions.length; i < ii; i++) {
    this.simulateActionOutcome(possibleActions[i], state);
  }
}

function simulateActionOutcome (action, currentState) {
  let that                  = this;
  // Copy the reference to the current state so other simulations can be performed on it
  const currentStateCopy      = this.getState(currentState);
  const currentComputerPoints = currentStateCopy.computer.get("points");
  const currentUserPoints     = currentStateCopy.user.get("points");

  this.get("game").placeCard(action.card, action.position, currentStateCopy, (outcomeState) => {
    const isComputerTurn = (outcomeState.playing === outcomeState.computer);

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
      if (action.outcomeState.possibleActions) {
        that.tryActions(action.outcomeState.possibleActions, action.outcomeState);
      }
    } else {
      action.outcomeState.possibleActions = null;
    }
  });
}

function findBestAction (possibleActions) {
  const pointsPerInitialAction = [];
  let maxPointsIndex = -1;
  let possibleAction;

  for (let i = 0, ii = possibleActions.length; i < ii; i++) {
    possibleAction            = possibleActions[i];
    pointsPerInitialAction[i] = findBestOutcomePoints(possibleAction.outcomeState);
  }

  maxPointsIndex = indexOf(pointsPerInitialAction, max(pointsPerInitialAction));

  return possibleActions[maxPointsIndex];
}

function findBestOutcomePoints (rootState) {
  const endGameOutcomePoints = [];
  let action;

  function recurse (currentState) {
    for (let i = 0, ii = currentState.possibleActions.length; i < ii; i++) {
      action = currentState.possibleActions[i];
      //console.log(action.id, action.card.get("deckIndex"), action.card.get("name"), action.position, action.outcomePoints);

      if (action.outcomeState.possibleActions) {
        recurse(action.outcomeState);
      } else {
        //console.log("== possible end action:", action, action.outcomeState.totalPoints);
        endGameOutcomePoints.push(action.outcomeState.totalPoints);
      }
    }
  }

  if (!rootState.possibleActions) {
    return rootState.totalPoints;
  }

  recurse(rootState);
  return max(endGameOutcomePoints);
}

function randomizeAction () {
  if (this.get("bestActionRate") === 100 || Math.random() <= this.get("bestActionRate") / 100) {
    return this.bestAction;
  }

  return sample(without(this.currentState.possibleActions, this.bestAction));
}
