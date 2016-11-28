define([
  "underscore", 
  "backbone",
  "models/model_card"
], function Coll_Album (_, Backbone, Model_Card) {
  return Backbone.Collection.extend({
    model        : Model_Card
  });
});
