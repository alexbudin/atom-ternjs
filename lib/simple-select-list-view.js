var $, EditorView, Keys, SelectListView, SimpleSelectListView, _, _ref,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

_ref = require("atom"), $ = _ref.$, SelectListView = _ref.SelectListView, EditorView = _ref.EditorView;

_ = require("underscore-plus");

Keys = {
  Escape: 27,
  Enter: 13,
  Tab: 9
};

SimpleSelectListView = (function(_super) {
  __extends(SimpleSelectListView, _super);

  function SimpleSelectListView() {
    return SimpleSelectListView.__super__.constructor.apply(this, arguments);
  }

  SimpleSelectListView.prototype.eventsAttached = false;

  SimpleSelectListView.prototype.maxItems = 10;

  SimpleSelectListView.content = function() {
    return this.div({
      "class": "select-list"
    }, (function(_this) {
      return function() {
        _this.input({
          "class": "fake-input",
          outlet: "fakeInput"
        });
        _this.div({
          "class": "error-message",
          outlet: "error"
        });
        _this.div({
          "class": "loading",
          outlet: "loadingArea"
        }, function() {
          _this.span({
            "class": "loading-message",
            outlet: "loading"
          });
          return _this.span({
            "class": "badge",
            outlet: "loadingBadge"
          });
        });
        return _this.ol({
          "class": "list-group",
          outlet: "list"
        });
      };
    })(this));
  };


  /*
   * Overrides default initialization
   */

  SimpleSelectListView.prototype.initialize = function() {
    this.on("core:move-up", (function(_this) {
      return function(e) {
        return _this.selectPreviousItemView();
      };
    })(this));
    return this.on("core:move-down", (function(_this) {
      return function() {
        return _this.selectNextItemView();
      };
    })(this));
  };

  SimpleSelectListView.prototype.setActive = function() {
    this.fakeInput.focus();
    if (!this.eventsAttached) {
      this.eventsAttached = true;
      return this.fakeInput.keydown((function(_this) {
        return function(e) {
          var _ref1;
          switch (e.keyCode) {
            case Keys.Enter:
            case Keys.Tab:
              _this.confirmSelection();
              break;
            case Keys.Escape:
              _this.cancel();
          }
          if (_ref1 = e.keyCode, __indexOf.call(_.values(Keys), _ref1) >= 0) {
            return false;
          }
        };
      })(this));
    }
  };

  SimpleSelectListView.prototype.populateList = function() {
    var i, item, itemView, _i, _ref1;
    if (this.items == null) {
      return;
    }
    this.list.empty();
    this.setError(null);
    for (i = _i = 0, _ref1 = Math.min(this.items.length, this.maxItems); 0 <= _ref1 ? _i < _ref1 : _i > _ref1; i = 0 <= _ref1 ? ++_i : --_i) {
      item = this.items[i];
      itemView = this.viewForItem(item);
      $(itemView).data("select-list-item", item);
      this.list.append(itemView);
    }
    return this.selectItemView(this.list.find("li:first"));
  };

  SimpleSelectListView.prototype.cancel = function() {
    this.list.empty();
    this.cancelling = true;
    this.detach();
    return this.cancelling = false;
  };

  return SimpleSelectListView;

})(SelectListView);

module.exports = SimpleSelectListView;
