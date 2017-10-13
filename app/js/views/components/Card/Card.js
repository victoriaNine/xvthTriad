import $ from 'jquery';
import { template, isNil } from 'lodash';
import Backbone from 'backbone';
import { TimelineMax } from 'gsap';

import _$ from 'common';
import Templ_Card from './template.ejs';

export default Backbone.View.extend({
  tagName   : "div",
  className : "card",
  template  : template(Templ_Card),
  events    : {},

  initialize,
  flip
});

function initialize (attributes, options = {}) {
  this.$el.html(this.template(this.model.attributes));
  this.$(".card-front").prepend($(_$.assets.get("svg.ui.cardBG")));

  if (_$.state.user.isInGame) {
    this.deckIndex = isNil(attributes.deckIndex) ? -1 : attributes.deckIndex;

    if (options.checkOwner) {
      if (this.model.get("owner") === _$.state.game.get("players").user) {
        this.$el.addClass("card-blue");
      } else {
        this.$el.addClass("card-red");
      }
    } else {
      // eslint-disable-next-line no-lonely-if
      if (this.model.get("currentOwner") === _$.state.game.get("players").user) {
        this.$el.addClass("card-blue");
      } else {
        this.$el.addClass("card-red");
      }
    }
  } else {
    this.$el.addClass("card-black");
  }
}

function flip (info = { fromSide: "right" }) {
  const tl = new TimelineMax();

  tl.call(() => {
    _$.audio.audioEngine.playSFX("cardFlip");
  });

  if (info.fromSide === "top") {
    tl.to(this.$el, 0.4, { rotationX: -180 });
  } else if (info.fromSide === "right") {
    tl.to(this.$el, 0.4, { rotationY: 180 });
  } else if (info.fromSide === "bottom") {
    tl.to(this.$el, 0.4, { rotationX: 180 });
  } else if (info.fromSide === "left") {
    tl.to(this.$el, 0.4, { rotationY: -180 });
  }

  tl.call(() => {
    this.$el.toggleClass("card-blue card-red");
  });

  if (info.fromSide === "top") {
    tl.to(this.$el, 0.4, { rotationX: -360 });
  } else if (info.fromSide === "right") {
    tl.to(this.$el, 0.4, { rotationY: 360 });
  } else if (info.fromSide === "bottom") {
    tl.to(this.$el, 0.4, { rotationX: 360 });
  } else if (info.fromSide === "left") {
    tl.to(this.$el, 0.4, { rotationY: -360 });
  }

  return tl;
}
