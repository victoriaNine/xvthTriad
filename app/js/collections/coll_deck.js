define([
  "underscore", 
  "backbone",
  "models/model_card"
], function Coll_Deck (_, Backbone, Model_Card) {
  return Backbone.Collection.extend({
    model          : Model_Card
  });
});
