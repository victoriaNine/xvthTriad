import Backbone from 'backbone';

export default Backbone.Model.extend({
  defaults : {
    type       : "computer",
    user       : null,
    name       : null,
    avatar     : null,
    deck       : null,
    points     : 5,
    rankPoints : 0
  }
});
