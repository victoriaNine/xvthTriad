import $ from 'jquery';
import { camelCase, noop } from 'lodash';
import { TweenMax } from 'gsap';

import _$ from 'common';

class Dropdown {
  constructor (options = {}) {
    this.screen             = options.screen;
    this.selector           = options.selector;
    this.dom                = this.screen.$(this.selector);
    this.dropdownDOM        = this.dom.find(options.dropdownSelector);
    this.defaultOption      = options.defaultOptionSelector ? this.dropdownDOM.find(options.defaultOptionSelector) : this.dropdownDOM.find("li").eq(0);
    this.defaultOptionIndex = _$.utils.getNodeIndex(this.defaultOption);
    this.height             = options.height || this.dom.height();
    this.name               = camelCase(this.selector);
    this.onUpdate           = options.onUpdate || noop;
    this.onOpen             = options.onOpen;
    this.currentOption      = null;
    this.isDisabled         = false;

    this.dom.click(this.toggle.bind(this));
    this.reset(true);
  }

  toggle (e) {
    if (this.isDisabled) {
      e.preventDefault();
      return false;
    }

    const closestValidOption = this.getClosestValidOption(e.target);
    const index              = _$.utils.getNodeIndex(closestValidOption);
    const callback           = closestValidOption === this.currentOption ? noop : this.onUpdate;

    if (this.dom.hasClass("is--active")) {
      $(window).off("click." + this.name);
      this.dom.removeClass("is--active");

      TweenMax.to(this.dropdownDOM[0], 0.4, { scrollTop: index * this.height, delay: 0.6, onComplete: callback });
      this.currentOption = closestValidOption;
    } else {
      this.dom.addClass("is--active");
      if (this.onOpen) {
        setTimeout(() => { this.onOpen(this); }, 200);
      }

      $(window).on("click." + this.name, (clickEvent) => {
        if (!$(clickEvent.target).parents(this.selector).length) {
          $(window).off("click." + this.name);
          this.dom.removeClass("is--active");
          this.scrollTo(this.currentOption, true);
        }
      });
    }
  }

  scrollTo (optionSelector, noCallback, checkValidity) {
    const selectedOption = this.dropdownDOM.find(optionSelector);
    const option         = checkValidity ? this.getClosestValidOption(selectedOption) : selectedOption;
    const index          = _$.utils.getNodeIndex(option);
    const callback       = noCallback ? noop : this.onUpdate;

    if (index === -1) {
      this.reset();
    } else {
      TweenMax.to(this.dropdownDOM[0], 0.4, { scrollTop: index * this.height, delay: 0.6, onComplete: callback });
      this.currentOption = option;
    }
  }

  reset (init) {
    const callback = init ? noop : this.onUpdate;
    TweenMax.to(this.dropdownDOM[0], 0.4, { scrollTop: this.defaultOptionIndex * this.height, delay: 0.6, onComplete: callback });
    this.currentOption = this.defaultOption;
  }

  remove  () { $(window).off("click." + this.name); }
  disable () { this.isDisabled = true; }
  enable  () { this.isDisabled = false; }

  getClosestValidOption (option) {
    const validOption = $(option).parent().children(":not(.is--disabled)").eq(0);
    return $(option).hasClass("is--disabled") ? validOption : $(option);
  }

  validitateCurrentOption (noUpdate, noCallback) {
    const closestValidOption = this.getClosestValidOption(this.currentOption);
    const isValid            = this.currentOption === closestValidOption;

    if (!isValid && !noUpdate) {
      this.scrollTo(closestValidOption, noCallback);
    }

    return isValid;
  }

  disableOption (option) {
    $(option).addClass("is--disabled");
  }

  enableOption (option) {
    $(option).removeClass("is--disabled");
  }
}

export default Dropdown;
