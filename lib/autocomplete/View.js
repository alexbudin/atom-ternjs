var $, $$, AutocompleteView, Editor, Perf, Q, Range, SelectListView, SimpleSelectListView, fuzzaldrin,  minimatch, path, _, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) {
        for (var key in parent) {
            if (__hasProp.call(parent, key)) child[key] = parent[key];
        }

        function ctor() {
            this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
    },
    __indexOf = [].indexOf || function(item) {
        for (var i = 0, l = this.length; i < l; i++) {
            if (i in this && this[i] === item) return i;
        }
        return -1;
    };

var _ = require('underscore-plus'),
    SimpleSelectListView = require('./simple-select-list-view'),
    path = require('path'),
    minimatch = require('minimatch'),
    fuzzaldrin = require('fuzzaldrin'),
    Perf = require('./perf'),
    Q = require('q'),
    customGetSugestions;

_ref = require('atom'), Editor = _ref.Editor, $ = _ref.$, $$ = _ref.$$, Range = _ref.Range, SelectListView = _ref.SelectListView;

module.exports = AutocompleteView = (function(_super) {
    __extends(AutocompleteView, _super);

    function AutocompleteView() {
        return AutocompleteView.__super__.constructor.apply(this, arguments);
    }

    AutocompleteView.prototype.setCustomGetSugestions = function(callback) {
        customGetSugestions = callback;
    };

    AutocompleteView.prototype.currentBuffer = null;

    AutocompleteView.prototype.wordList = null;

    AutocompleteView.prototype.wordRegex = /\b\w*[a-zA-Z_]\w*\b/g;

    AutocompleteView.prototype.originalCursorPosition = null;

    AutocompleteView.prototype.aboveCursor = false;

    AutocompleteView.prototype.debug = false;

    AutocompleteView.prototype.initialize = function(editorView) {
        this.editorView = editorView;
        AutocompleteView.__super__.initialize.apply(this, arguments);
        this.addClass('autocomplete popover-list');
        this.editor = this.editorView.editor;
        if (this.currentFileBlacklisted()) {
            return;
        }
        this.handleEvents();
        return this.setCurrentBuffer(this.editor.getBuffer());
    };


    /*
     * Checks whether the current file is blacklisted
     */

    AutocompleteView.prototype.currentFileBlacklisted = function() {
        var blacklist, blacklistGlob, fileName, _i, _len;
        blacklist = atom.config.get("ternjs.fileBlacklist").split(",").map(function(s) {
            return s.trim();
        });
        fileName = path.basename(this.editor.getBuffer().getPath());
        for (_i = 0, _len = blacklist.length; _i < _len; _i++) {
            blacklistGlob = blacklist[_i];
            if (minimatch(fileName, blacklistGlob)) {
                return true;
            }
        }
        return false;
    };


    /*
     * Creates a view for the given item
     */

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


    /*
     * Handles editor events
     */

    AutocompleteView.prototype.handleEvents = function() {
        this.list.on('mousewheel', function(event) {
            return event.stopPropagation();
        });
        if (!atom.config.get('ternjs.liveCompletion')) {
            this.editor.on('contents-modified', (function(_this) {
                return function() {
                    return _this.contentsModified();
                };
            })(this));
        }
        this.editor.on('title-changed-subscription-removed', (function(_this) {
            return function() {
                return _this.cancel();
            };
        })(this));
        return this.editor.on('cursor-moved', (function(_this) {
            return function(data) {
                if (!data.textChanged) {
                    return _this.cancel();
                }
            };
        })(this));
    };


    /*
     * Return false so that the events don't bubble up to the editor
     */

    AutocompleteView.prototype.selectNextItemView = function() {
        AutocompleteView.__super__.selectNextItemView.apply(this, arguments);
        return false;
    };


    /*
     * Return false so that the events don't bubble up to the editor
     */

    AutocompleteView.prototype.selectPreviousItemView = function() {
        AutocompleteView.__super__.selectPreviousItemView.apply(this, arguments);
        return false;
    };


    /*
     * Don't really know what that does...
     */

    AutocompleteView.prototype.getCompletionsForCursorScope = function() {
        var completions, cursorScope;
        cursorScope = this.editor.scopesForBufferPosition(this.editor.getCursorBufferPosition());
        completions = atom.syntax.propertiesForScope(cursorScope, 'editor.completions');
        completions = completions.map(function(properties) {
            return _.valueForKeyPath(properties, 'editor.completions');
        });
        return _.uniq(_.flatten(completions));
    };


    /*
     * Generates the word list from the editor buffer(s)
     */

    AutocompleteView.prototype.buildWordList = function() {
        var deferred;
        deferred = Q.defer();
        process.nextTick((function(_this) {
            return function() {
                var buffer, buffers, matches, objectKeyBlacklist, p, word, wordHash, wordList, words, _i, _j, _k, _len, _len1, _len2;
                wordHash = {};
                if (atom.config.get('ternjs.includeCompletionsFromAllBuffers')) {
                    buffers = atom.project.getBuffers();
                } else {
                    buffers = [_this.currentBuffer];
                }
                matches = [];
                p = new Perf("Building word list", {
                    debug: _this.debug
                });
                p.start();
                for (_i = 0, _len = buffers.length; _i < _len; _i++) {
                    buffer = buffers[_i];
                    matches.push(buffer.getText().match(_this.wordRegex));
                }
                matches.push(_this.getCompletionsForCursorScope());
                words = _.flatten(matches);
                for (_j = 0, _len1 = words.length; _j < _len1; _j++) {
                    word = words[_j];
                    if (wordHash[word] == null) {
                        wordHash[word] = true;
                    }
                }
                wordList = Object.keys(wordHash);
                objectKeyBlacklist = ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'constructor'];
                for (_k = 0, _len2 = objectKeyBlacklist.length; _k < _len2; _k++) {
                    word = objectKeyBlacklist[_k];
                    if (__indexOf.call(words, word) >= 0) {
                        wordList.push(word);
                    }
                }
                _this.wordList = wordList;
                p.stop();
                return deferred.resolve();
            };
        })(this));
        return deferred.promise;
    };


    /*
     * Handles confirmation (the user pressed enter)
     */

    AutocompleteView.prototype.confirmed = function(match) {
        var position;
        this.editor.getSelection().clear();
        this.cancel();
        if (!match) {
            return;
        }
        this.replaceTextWithMatch(match);
        position = this.editor.getCursorBufferPosition();
        return this.editor.setCursorBufferPosition([position.row, position.column]);
    };


    /*
     * Activates
     */

    AutocompleteView.prototype.setActive = function() {
        AutocompleteView.__super__.setActive.apply(this, arguments);
        return this.active = true;
    };


    /*
     * Clears the list, sets back the cursor, focuses the editor and
     * detaches the list DOM element
     */

    AutocompleteView.prototype.cancel = function() {
        this.active = false;
        this.list.empty();
        this.editorView.focus();
        return this.detach();
    };

    AutocompleteView.prototype.contentsModified = function() {
        var prefix, selection, suggestions;
        if (this.active) {
            this.detach();
            this.list.empty();
            this.editorView.focus();
        }
        selection = this.editor.getSelection();
        prefix = this.prefixOfSelection(selection);
        if (!prefix.length) {
            return;
        }
        if (customGetSugestions) {
            return customGetSugestions(prefix, this.editor, (function(_this) {
                return function(suggestions) {
                    if (!suggestions.length) {
                        return;
                    }
                    _this.setItems(suggestions);
                    _this.editorView.appendToLinesView(_this);
                    _this.setPosition();
                    return _this.setActive();
                };
            })(this));
        } else {
            suggestions = this.findMatchesForWord(prefix);

            if (!suggestions.length) {
                return;
            }
            this.setItems(suggestions);
            this.editorView.appendToLinesView(this);
            this.setPosition();
            return this.setActive();
        }
    };

    AutocompleteView.prototype.findMatchesForWord = function(prefix) {
        var p, results, word, words;
        p = new Perf("Finding matches for '" + prefix + "'", {
            debug: this.debug
        });
        p.start();
        words = fuzzaldrin.filter(this.wordList, prefix);
        results = (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = words.length; _i < _len; _i++) {
                word = words[_i];
                if (word !== prefix) {
                    _results.push({
                        prefix: prefix,
                        word: word
                    });
                }
            }
            return _results;
        })();
        p.stop();
        return results;
    };

    AutocompleteView.prototype.setPosition = function() {
        var height, left, potentialBottom, potentialTop, top, _ref1;
        _ref1 = this.editorView.pixelPositionForScreenPosition(this.editor.getCursorScreenPosition()), left = _ref1.left, top = _ref1.top;
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


    /*
     * Replaces the current prefix with the given match
     */

    AutocompleteView.prototype.replaceTextWithMatch = function(match) {
        var buffer, cursorPosition, infixLength, selection, startPosition;
        selection = this.editor.getSelection();
        startPosition = selection.getBufferRange().start;
        buffer = this.editor.getBuffer();
        selection.deleteSelectedText();
        cursorPosition = this.editor.getCursorBufferPosition();
        buffer["delete"](Range.fromPointWithDelta(cursorPosition, 0, -match.prefix.length));
        this.editor.insertText(match.word);
        infixLength = match.word.length - match.prefix.length;
        return this.editor.setSelectedBufferRange([startPosition, [startPosition.row, startPosition.column + infixLength]]);
    };


    /*
     * Finds and returns the content before the current cursor position
     */

    AutocompleteView.prototype.prefixOfSelection = function(selection) {
        var lineRange, prefix, selectionRange;
        selectionRange = selection.getBufferRange();
        lineRange = [
            [selectionRange.start.row, 0],
            [selectionRange.end.row, this.editor.lineLengthForBufferRow(selectionRange.end.row)]
        ];
        prefix = "";
        this.currentBuffer.scanInRange(this.wordRegex, lineRange, function(_arg) {
            var match, prefixOffset, range, stop;
            match = _arg.match, range = _arg.range, stop = _arg.stop;
            if (range.start.isGreaterThan(selectionRange.end)) {
                stop();
            }
            if (range.intersectsWith(selectionRange)) {
                prefixOffset = selectionRange.start.column - range.start.column;
                if (range.start.isLessThan(selectionRange.start)) {
                    return prefix = match[0].slice(0, prefixOffset);
                }
            }
        });
        return prefix;
    };


    /*
     * Finds the last typed word. If newLine is set to true, it looks
     * for the last word in the previous line.
     */

    AutocompleteView.prototype.lastTypedWord = function(newLine) {
        var lastWord, lineRange, maxColumn, row, selectionRange;
        selectionRange = this.editor.getSelection().getBufferRange();
        row = selectionRange.start.row;
        if (newLine) {
            row--;
        }
        if (newLine) {
            maxColumn = this.editor.lineLengthForBufferRow(row);
        } else {
            maxColumn = selectionRange.start.column;
        }
        lineRange = [
            [row, 0],
            [row, maxColumn]
        ];
        lastWord = null;
        this.currentBuffer.scanInRange(this.wordRegex, lineRange, function(_arg) {
            var match, range, stop;
            match = _arg.match, range = _arg.range, stop = _arg.stop;
            return lastWord = match[0];
        });
        return lastWord;
    };


    /*
     * As soon as the list is in the DOM tree, it calculates the
     * maximum width of all list items and resizes the list so that
     * all items fit
     *
     * @todo: Fix this. Doesn't work well yet.
     */

    AutocompleteView.prototype.afterAttach = function(onDom) {
        var widestCompletion;
        if (onDom) {
            widestCompletion = parseInt(this.css('min-width')) || 0;
            this.list.find('span').each(function() {
                return widestCompletion = Math.max(widestCompletion, $(this).outerWidth());
            });
            this.list.width(widestCompletion + 15);
            return this.width(this.list.outerWidth());
        }
    };


    /*
     * Updates the list's position when populating results
     */

    AutocompleteView.prototype.populateList = function() {
        var p;
        p = new Perf("Populating list", {
            debug: this.debug
        });
        p.start();
        AutocompleteView.__super__.populateList.apply(this, arguments);
        p.stop();
        return this.setPosition();
    };


    /*
     * Sets the current buffer
     */

    AutocompleteView.prototype.setCurrentBuffer = function(currentBuffer) {
        this.currentBuffer = currentBuffer;
        this.buildWordList();
        this.currentBuffer.on("saved", (function(_this) {
            return function() {
                return _this.buildWordList();
            };
        })(this));
        if (atom.config.get('ternjs.liveCompletion')) {
            return this.currentBuffer.on("changed", (function(_this) {
                return function(e) {
                    var _ref1;
                    if ((_ref1 = e.newText) === "\n" || _ref1 === " ") {
                        _this.addLastWordToList(e.newText === "\n");
                    }
                    if (e.newText.length) {
                        return _this.contentsModified();
                    } else {
                        return _this.cancel();
                    }
                };
            })(this));
        }
    };

    /*
     * Adds the last typed word to the wordList
     */

    AutocompleteView.prototype.addLastWordToList = function(newLine) {
        var lastWord;
        lastWord = this.lastTypedWord(newLine);
        if (!lastWord) {
            return;
        }
        if (this.wordList.indexOf(lastWord) < 0) {
            return this.wordList.push(lastWord);
        }
    };


    /*
     * Defines which key we would like to use for filtering
     */

    AutocompleteView.prototype.getFilterKey = function() {
        return 'word';
    };

    AutocompleteView.prototype.getModel = function() {
        return null;
    };

    return AutocompleteView;

})(SimpleSelectListView);
