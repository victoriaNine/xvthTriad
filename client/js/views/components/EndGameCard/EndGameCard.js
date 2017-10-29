import { template } from 'lodash';
import Backbone from 'backbone';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'utils';
import Comp_Card from 'Components/Card';
import Templ_EndGameCard from './template.ejs';

export default Backbone.View.extend({
  tagName   : "li",
  className : "game_overlay-endGame-album-card",
  template  : template(Templ_EndGameCard),
  events    : {
    /* eslint-disable object-shorthand */
    "mouseenter .card-red" : function (e) {
      _$.audio.audioEngine.playSFX("cardSort");
      TweenMax.set(e.currentTarget, { scale: "1.1" });
    },
    "mouseleave .card-red" : function (e) { TweenMax.set(e.currentTarget, { scale: "1" }); },
    "click .card"          : "selectCard"
    /* eslint-enable */
  },

  initialize,
  selectCard
});

function initialize (options) {
  this.selected  = false;
  this.deckIndex = options.deckIndex;
  this.cardView  = new Comp_Card({ model: options.card }, { checkOwner: true });

  this.$el.html(this.template({
    name: this.cardView.model.get("name")
  }));

  const isOwned = !!_$.state.user.get("album").models.find(card => card.attributes.cardId === this.cardView.model.get("cardId"));
  const isUserCard = this.cardView.model.get("owner") === _$.state.game.get("players").user;
  if (isOwned && !isUserCard) {
    this.$el.addClass("is--owned");
  }

  this.$(".game_overlay-endGame-album-card-visual").append(this.cardView.$el);

  if (
    !_$.state.game.get("cardsToPickCount") ||
    _$.state.game.get("winner") !== _$.state.game.get("players").user ||
    isUserCard
  ) {
    this.events = {};
    TweenMax.set(this.$el, { pointerEvents: "none" });
    this.undelegateEvents();
  }
}

function selectCard (event, removingExcess) {
  this.selected = !this.selected;

  const tl = new TimelineMax({ delay: removingExcess ? 0.15 : 0 });
  tl.set(this.$(".card"), { scale: "1" });
  tl.add(this.cardView.flip());

  if (!removingExcess) {
    _$.events.trigger("endGameCardSelected", { endGameCardView: this, selected: this.selected });
  }
}
