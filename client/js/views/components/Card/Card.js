import { template, isNil } from 'lodash';
import Backbone from 'backbone';
import { TimelineMax } from 'gsap';

import _$ from 'utils';
import Templ_Card from './template.ejs';

import svgCardBG from '!svg-inline-loader!Assets/svg/ui/cardBG.svg';

export default Backbone.View.extend({
  tagName   : "div",
  className : "card",
  template  : template(Templ_Card),
  events    : {
    /* eslint-disable object-shorthand */
    "mouseenter": "showTooltip",
    "touchstart": "showTooltip",
    "mouseleave": "hideTooltip",
    "touchend": "hideTooltip",
    /* eslint-enable */
  },

  initialize,
  flip,
  showTooltip,
  hideTooltip,
});

function initialize (attributes, options = {}) {
  this.$el.html(this.template(this.model.attributes));
  this.$(".card-front").prepend(svgCardBG);

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

function showTooltip (e) {
  if (_$.state.user.isInGame) {
    e = e.originalEvent;

    let pageX = e.pageX;
    let pageY = e.pageY;

    if (e.type === "touchstart" && e.targetTouches && e.targetTouches.length === 1) {
      pageX = e.targetTouches[0].pageX;
      pageY = e.targetTouches[0].pageY;
    }

    pageX *= _$.ui.window.devicePixelRatio / _$.state.appScalar;
    pageY *= _$.ui.window.devicePixelRatio / _$.state.appScalar;

    _$.ui.screen.showCardTooltip({
      x: pageX,
      y: pageY,
      name: this.model.get("name"),
      isOwned: !!_$.state.user.get("album").models.find(card => card.attributes.cardId === this.model.get("cardId")),
      isUserCard: this.model.get("owner") === _$.state.game.get("players").user,
      isPlayed: !!this.model.get("position")
    });
  }
}

function hideTooltip () {
  if (_$.state.user.isInGame) {
    _$.ui.screen.hideCardTooltip();
  }
}
