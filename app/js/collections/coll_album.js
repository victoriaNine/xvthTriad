define([
  "underscore", 
  "backbone",
  "global",
  "models/model_card"
], function Coll_Album (_, Backbone, _$, Model_Card) {
    return Backbone.Collection.extend({
        model: Model_Card
    });
});
