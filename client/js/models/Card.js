import { isNil, isString, camelCase } from 'lodash';
import Backbone from 'backbone';

export default Backbone.Model.extend({
  defaults : {
    name       : "",
    image      : "",
    level      : 1,
    ranks      : {
      top    : 1,
      right  : 1,
      bottom : 1,
      left   : 1
    },
    element      : null,

    owner        : null,
    currentOwner : null,
    position     : null,
    bonus        : 0,
    deckIndex    : -1
  },

  initialize,
  validate,

  setImagePath,
  getRanksSum,
  reset
});

function initialize (attributes, options) { // eslint-disable-line no-unused-vars
  this.validate(attributes);
  this.setImagePath();
}

function validate (attributes, options) { // eslint-disable-line no-unused-vars
  if (isNil(attributes.name) || !isString(attributes.name) || attributes.name === "") {
    return "The card's name needs to be defined.";
  }
}

function setImagePath () {
  const url = require(`Assets/img/cards/level${this.get("level")}/${camelCase(this.get("name"))}.png`);
  this.set("image", "." + url);
}

function getRanksSum () {
  return (this.get("ranks").top + this.get("ranks").right + this.get("ranks").bottom + this.get("ranks").left);
}

function reset () {
  this.set({
    owner        : this.defaults.owner,
    currentOwner : this.defaults.currentOwner,
    position     : this.defaults.position,
    bonus        : this.defaults.bonus,
    deckIndex    : this.defaults.deckIndex
  });
}
