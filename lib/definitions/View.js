var DefinitionsView,
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
    View = require('atom').View,
    path = require('path'),
    //CSON = require('season'),
    //ViolationView = require('./violation-view'),
    customGetDefinitions = null;
    //linterMap = CSON.readFileSync(path.join(__dirname, 'linter-map.cson'));

module.exports = DefinitionsView = (function(_super) {
    __extends(DefinitionsView, _super);

    function DefinitionsView() {
        return DefinitionsView.__super__.constructor.apply(this, arguments);
    }

    DefinitionsView.prototype.editorView = null;
    DefinitionsView.prototype.editor = 'test';

    DefinitionsView.content = function() {
        return this.div({
            "class": 'def'
        });
    };

    DefinitionsView.prototype.initialize = function(editorView, customGetDefinitionsCallback) {
        if (!customGetDefinitions) {
            customGetDefinitions = customGetDefinitionsCallback;
        }
        this.editorView = editorView;
        this.editor = this.editorView.getEditor();
console.log(this);

        this.violationViews = [];
        this.handleEvents();
    };

    DefinitionsView.prototype.contentsModified = function() {
        var prefix, selection, suggestions;
        if (this.active) {
            this.detach();
            this.editorView.focus();
        }
        console.log(this.editor);

        selection = this.editor.getSelection();
        prefix = this.prefixOfSelection(selection);
        if (!prefix.length) {
            return;
        }

        self.setPosition();

        //
        // return customGetDefinitions(prefix, this.editor, function(definition) {
        //     if (!definition) {
        //         return;
        //     }
        //     // self.setItems(suggestions);
        //     // self.editorView.appendToLinesView(_this);
        //     self.setPosition();
        //     return self.setActive();
        // });
    };

    DefinitionsView.prototype.setPosition = function() {
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
     * Clears the list, sets back the cursor, focuses the editor and
     * detaches the list DOM element
     */

    DefinitionsView.prototype.cancel = function() {
        this.active = false;
        this.editorView.focus();
    };

    /*
     * Handles editor events
     */
    DefinitionsView.prototype.handleEvents = function() {
        var self = this;
        this.editor.on('contents-modified', this.contentsModified);
        this.editor.on('title-changed-subscription-removed', function() {
            return self.cancel();
        });
        return this.editor.on('cursor-moved', function(data) {
            if (!data.textChanged) {
                return self.cancel();
            }
        });
    };

    DefinitionsView.prototype.beforeRemove = function() {
        return this.disable();
    };

    return DefinitionsView;

})(View);
