define([
  "underscore", 
  "backbone",
  "storage", 
  "models/model_card"
], function Collection (_, Backbone, Store, Card) {
  return Backbone.Collection.extend({
    model        : Card,
    //localStorage : new Store("todos")
  });
});
