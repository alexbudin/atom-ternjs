var $, $$, AutocompleteView, Range, SelectListView, _, _ref,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require('underscore-plus');

_ref = require('atom'), $ = _ref.$, $$ = _ref.$$, Range = _ref.Range, SelectListView = _ref.SelectListView;

module.exports = AutocompleteView = (function(_super) {
  __extends(AutocompleteView, _super);

  function AutocompleteView() {
    return AutocompleteView.__super__.constructor.apply(this, arguments);
  }

  AutocompleteView.prototype.currentBuffer = null;

  AutocompleteView.prototype.wordList = null;

  AutocompleteView.prototype.wordRegex = /\w+/g;

  AutocompleteView.prototype.originalSelectionBufferRange = null;

  AutocompleteView.prototype.originalCursorPosition = null;

  AutocompleteView.prototype.aboveCursor = false;

  AutocompleteView.prototype.initialize = function(editorView) {
    this.editorView = editorView;
    AutocompleteView.__super__.initialize.apply(this, arguments);
    this.addClass('autocomplete popover-list');
    this.editor = this.editorView.editor;
    this.handleEvents();
    return this.setCurrentBuffer(this.editor.getBuffer());
  };

  AutocompleteView.prototype.getFilterKey = function() {
    return 'word';
  };

  AutocompleteView.prototype.viewForItem = function(_arg) {
    var word;
    word = _arg.word;
    return $$(function() {
      return this.li((function(_this) {
        return function() {
          return _this.span(word);
        };
      })(this));
    });
  };

  AutocompleteView.prototype.handleEvents = function() {
    this.list.on('mousewheel', function(event) {
      return event.stopPropagation();
    });
    this.editorView.on('editor:path-changed', (function(_this) {
      return function() {
        return _this.setCurrentBuffer(_this.editor.getBuffer());
      };
    })(this));
    this.editorView.command('autocomplete:attach', (function(_this) {
      return function() {
        return _this.attach();
      };
    })(this));
    this.editorView.command('autocomplete:next', (function(_this) {
      return function() {
        return _this.selectNextItemView();
      };
    })(this));
    this.editorView.command('autocomplete:previous', (function(_this) {
      return function() {
        return _this.selectPreviousItemView();
      };
    })(this));
    return this.filterEditorView.preempt('textInput', (function(_this) {
      return function(_arg) {
        var originalEvent, text;
        originalEvent = _arg.originalEvent;
        text = originalEvent.data;
        if (!text.match(_this.wordRegex)) {
          _this.confirmSelection();
          _this.editor.insertText(text);
          return false;
        }
      };
    })(this));
  };

  AutocompleteView.prototype.setCurrentBuffer = function(currentBuffer) {
    this.currentBuffer = currentBuffer;
  };

  AutocompleteView.prototype.selectItemView = function(item) {
    var match;
    AutocompleteView.__super__.selectItemView.apply(this, arguments);
    if (match = this.getSelectedItem()) {
      return this.replaceSelectedTextWithMatch(match);
    }
  };

  AutocompleteView.prototype.selectNextItemView = function() {
    AutocompleteView.__super__.selectNextItemView.apply(this, arguments);
    return false;
  };

  AutocompleteView.prototype.selectPreviousItemView = function() {
    AutocompleteView.__super__.selectPreviousItemView.apply(this, arguments);
    return false;
  };

  AutocompleteView.prototype.getCompletionsForCursorScope = function() {
    var completions, cursorScope;
    cursorScope = this.editor.scopesForBufferPosition(this.editor.getCursorBufferPosition());
    completions = atom.syntax.propertiesForScope(cursorScope, 'editor.completions');
    completions = completions.map(function(properties) {
      return _.valueForKeyPath(properties, 'editor.completions');
    });
    return _.uniq(_.flatten(completions));
  };

  AutocompleteView.prototype.buildWordList = function() {
    var buffer, buffers, matches, word, wordHash, _i, _j, _k, _len, _len1, _len2, _ref1, _ref2;
    wordHash = {};
    if (atom.config.get('autocomplete.includeCompletionsFromAllBuffers')) {
      buffers = atom.project.getBuffers();
    } else {
      buffers = [this.currentBuffer];
    }
    matches = [];
    for (_i = 0, _len = buffers.length; _i < _len; _i++) {
      buffer = buffers[_i];
      matches.push(buffer.getText().match(this.wordRegex));
    }
    _ref1 = _.flatten(matches);
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      word = _ref1[_j];
      if (wordHash[word] == null) {
        wordHash[word] = true;
      }
    }
    _ref2 = this.getCompletionsForCursorScope();
    for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
      word = _ref2[_k];
      if (wordHash[word] == null) {
        wordHash[word] = true;
      }
    }
    return this.wordList = Object.keys(wordHash).sort(function(word1, word2) {
      return word1.toLowerCase().localeCompare(word2.toLowerCase());
    });
  };

  AutocompleteView.prototype.confirmed = function(match) {
    var position;
    this.editor.getSelection().clear();
    this.cancel();
    if (!match) {
      return;
    }
    this.replaceSelectedTextWithMatch(match);
    position = this.editor.getCursorBufferPosition();
    return this.editor.setCursorBufferPosition([position.row, position.column + match.suffix.length]);
  };

  AutocompleteView.prototype.cancelled = function() {
    AutocompleteView.__super__.cancelled.apply(this, arguments);
    this.editor.abortTransaction();
    this.editor.setSelectedBufferRange(this.originalSelectionBufferRange);
    return this.editorView.focus();
  };

  AutocompleteView.prototype.attach = function() {
    var matches;
    this.editor.beginTransaction();
    this.aboveCursor = false;
    this.originalSelectionBufferRange = this.editor.getSelection().getBufferRange();
    this.originalCursorPosition = this.editor.getCursorScreenPosition();
    this.buildWordList();
    matches = this.findMatchesForCurrentSelection();
    this.setItems(matches);
    if (matches.length === 1) {
      return this.confirmSelection();
    } else {
      this.editorView.appendToLinesView(this);
      this.setPosition();
      return this.focusFilterEditor();
    }
  };

  AutocompleteView.prototype.setPosition = function() {
    var height, left, potentialBottom, potentialTop, top, _ref1;
    _ref1 = this.editorView.pixelPositionForScreenPosition(this.originalCursorPosition), left = _ref1.left, top = _ref1.top;
    height = this.outerHeight();
    potentialTop = top + this.editorView.lineHeight;
    potentialBottom = potentialTop - this.editorView.scrollTop() + height;
    if (this.aboveCursor || potentialBottom > this.editorView.outerHeight()) {
      this.aboveCursor = true;
      return this.css({
        left: left,
        top: top - height,
        bottom: 'inherit'
      });
    } else {
      return this.css({
        left: left,
        top: potentialTop,
        bottom: 'inherit'
      });
    }
  };

  AutocompleteView.prototype.findMatchesForCurrentSelection = function() {
    var currentWord, prefix, regex, selection, suffix, word, _i, _j, _len, _len1, _ref1, _ref2, _ref3, _results, _results1;
    selection = this.editor.getSelection();
    _ref1 = this.prefixAndSuffixOfSelection(selection), prefix = _ref1.prefix, suffix = _ref1.suffix;
    if ((prefix.length + suffix.length) > 0) {
      regex = new RegExp("^" + prefix + ".+" + suffix + "$", "i");
      currentWord = prefix + this.editor.getSelectedText() + suffix;
      _ref2 = this.wordList;
      _results = [];
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        word = _ref2[_i];
        if (regex.test(word) && word !== currentWord) {
          _results.push({
            prefix: prefix,
            suffix: suffix,
            word: word
          });
        }
      }
      return _results;
    } else {
      _ref3 = this.wordList;
      _results1 = [];
      for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
        word = _ref3[_j];
        _results1.push({
          word: word,
          prefix: prefix,
          suffix: suffix
        });
      }
      return _results1;
    }
  };

  AutocompleteView.prototype.replaceSelectedTextWithMatch = function(match) {
    var buffer, cursorPosition, infixLength, selection, startPosition;
    selection = this.editor.getSelection();
    startPosition = selection.getBufferRange().start;
    buffer = this.editor.getBuffer();
    selection.deleteSelectedText();
    cursorPosition = this.editor.getCursorBufferPosition();
    buffer["delete"](Range.fromPointWithDelta(cursorPosition, 0, match.suffix.length));
    buffer["delete"](Range.fromPointWithDelta(cursorPosition, 0, -match.prefix.length));
    this.editor.insertText(match.word);
    infixLength = match.word.length - match.prefix.length - match.suffix.length;
    return this.editor.setSelectedBufferRange([startPosition, [startPosition.row, startPosition.column + infixLength]]);
  };

  AutocompleteView.prototype.prefixAndSuffixOfSelection = function(selection) {
    var lineRange, prefix, selectionRange, suffix, _ref1;
    selectionRange = selection.getBufferRange();
    lineRange = [[selectionRange.start.row, 0], [selectionRange.end.row, this.editor.lineLengthForBufferRow(selectionRange.end.row)]];
    _ref1 = ["", ""], prefix = _ref1[0], suffix = _ref1[1];
    this.currentBuffer.scanInRange(this.wordRegex, lineRange, function(_arg) {
      var match, prefixOffset, range, stop, suffixOffset;
      match = _arg.match, range = _arg.range, stop = _arg.stop;
      if (range.start.isGreaterThan(selectionRange.end)) {
        stop();
      }
      if (range.intersectsWith(selectionRange)) {
        prefixOffset = selectionRange.start.column - range.start.column;
        suffixOffset = selectionRange.end.column - range.end.column;
        if (range.start.isLessThan(selectionRange.start)) {
          prefix = match[0].slice(0, prefixOffset);
        }
        if (range.end.isGreaterThan(selectionRange.end)) {
          return suffix = match[0].slice(suffixOffset);
        }
      }
    });
    return {
      prefix: prefix,
      suffix: suffix
    };
  };

  AutocompleteView.prototype.afterAttach = function(onDom) {
    var widestCompletion;
    if (onDom) {
      widestCompletion = parseInt(this.css('min-width')) || 0;
      this.list.find('span').each(function() {
        return widestCompletion = Math.max(widestCompletion, $(this).outerWidth());
      });
      this.list.width(widestCompletion);
      return this.width(this.list.outerWidth());
    }
  };

  AutocompleteView.prototype.populateList = function() {
    AutocompleteView.__super__.populateList.apply(this, arguments);
    return this.setPosition();
  };

  return AutocompleteView;

})(SelectListView);