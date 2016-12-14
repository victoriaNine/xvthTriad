define([
  "underscore", 
  "backbone",
  "models/model_card",
  "global"
], function Coll_Album (_, Backbone, Model_Card, _$) {
    return Backbone.Collection.extend({
        model: Model_Card
    });
});
