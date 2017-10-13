import Backbone from 'backbone';

import _$ from 'common';
import Model_Card from 'Models/Card';

export default Backbone.Collection.extend({
  model      : Model_Card,
  comparator : "cardId",

  initialize
});

function initialize (cards, options) {
  const randomCards = _$.utils.getRandomCards({ amount: 7, level: 1, unique: true });
  if (!cards) {
    this.reset(randomCards, { silent: true, ...options });
  }
}
