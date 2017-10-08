import Backbone from 'backbone';

import _$ from 'global';
import Model_Card from './../models/Card';

export default Backbone.Collection.extend({
    model      : Model_Card,
    comparator : "cardId",

    initialize
});

function initialize (cards, options) {
    var randomCards = _$.utils.getRandomCards({ amount: 7, level: 1, unique: true });
    if (!cards) {
        this.reset(randomCards, { silent: true, ...options });
    }
};
