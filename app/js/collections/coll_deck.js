define([
  "underscore", 
  "backbone",
  "storage", 
  "models/model_card"
], function Coll_Deck (_, Backbone, Store, Model_Card) {
  return Backbone.Collection.extend({
    model          : Model_Card,
    //localStorage : new Store("todos")
  });
});
