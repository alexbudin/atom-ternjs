"use strict";

var AutocompleteView = require('./autocomplete/View'),
    TernServer = require('./Tern/Server'),
    TernRequest = require('./Tern/Request'),
    autocompleteView,
    MessageIds = TernServer.MessageIds;

/**
 * Our logging method...
 *
 * @param {string} msg - the log message
 */
function _log(msg) {
    throw msg;
}

/**
 * Get definition location
 * @param {{type: string, name: string, offsetLines: number, text: string}} fileInfo
 * - type of update, name of file, and the text of the update.
 * For "full" updates, the whole text of the file is present. For "part" updates,
 * the changed portion of the text. For "empty" updates, the file has not been modified
 * and the text is empty.
 * @param {{line: number, ch: number}} offset - the offset into the
 * file for cursor
 */
function getJumptoDef(fileInfo, offset) {
    var request = new TernRequest(fileInfo, "definition", offset);

    // FIXME: tern doesn't work exactly right yet.
    // request.query.typeOnly = true;

    TernServer.request(request, function(error, data) {
        if (error) {
            _log("Error returned from Tern 'definition' request: " + error);
            return;
        }
        var isFunc = false,
            response = {
                type: MessageIds.TERN_JUMPTODEF_MSG,
                file: fileInfo.name,
                resultFile: data.file,
                offset: offset,
                start: data.start,
                end: data.end
            };

        request = new TernRequest(fileInfo, "type", offset);
        // See if we can tell if the reference is to a Function type
        TernServer.request(request, function(error, data) {
            if (!error) {
                response.isFunction = data.type.length > 2 && data.type.substring(0, 2) === "fn";
            }

            // Post a message back to the main thread with the definition
            self.postMessage(response);
        });

    });
}
/**
 * Request hints from Tern.
 *
 * Note that successive calls to getScope may return the same objects, so
 * clients that wish to modify those objects (e.g., by annotating them based
 * on some temporary context) should copy them first. See, e.g.,
 * Session.getHints().
 *
 * @param {Session} session - the active hinting session
 * @param {Document} document - the document for which scope info is
 *      desired
 * @return {jQuery.Promise} - The promise will not complete until the tern
 *      hints have completed.
 */
function requestHints(prefix, editor, callback) {
    var propertyLookup = false,
        hintPromise,
        lexical,
        cursor,
        fileInfo = getFileInfo(editor);

    // TODO: We need to check and see if the property is done in a dynamic way
    // aka this['fun']

    if (findPreviousDot(editor, editor.cursors[0])) {
        propertyLookup = true;
    }

    var cursorPos = editor.cursors[0].getScreenPosition();

    getTernHints(fileInfo, {
        line: cursorPos.row,
        ch: cursorPos.column
    }, propertyLookup, prefix, callback);

}
/**
 * Get all the known properties for guessing.
 *
 * @param {{type: string, name: string, offsetLines: number, text: string}} fileInfo
 * - type of update, name of file, and the text of the update.
 * For "full" updates, the whole text of the file is present. For "part" updates,
 * the changed portion of the text. For "empty" updates, the file has not been modified
 * and the text is empty.
 * @param {{line: number, ch: number}} offset -
 * the offset into the file where we want completions for
 * @param {string} type     - the type of the message to reply with.
 */
function getTernProperties(fileInfo, offset, type, prefix, callback) {

    var request = new TernRequest(fileInfo, "properties", offset);

    TernServer.request(request, function(error, data) {
        if (error) return _log("Error returned from Tern 'properties' request: " + error);

        var properties = [];

        //_log("tern properties: completions = " + data.completions.length);
        for (var i = 0; i < data.completions.length; ++i) {
            var property = data.completions[i];
            properties.push({
                word: property,
                prefix: prefix,
                type: property.type,
                guess: true
            });
        }

        callback(properties);
    });
}

/**
 * Get an object that describes what tern needs to know about the updated
 * file to produce a hint. As a side-effect of this calls the document
 * changes are reset.
 *
 * @param {!Session} session - the current session
 * Optional, defaults to false.
 * @return {{type: string, name: string, offsetLines: number, text: string}}
 */
function getFileInfo(editor) {
    // TODO: make use of HTML files that contain JS
    // TODO: support the lack of document changes outside the current line to speed up TernJS
    // TODO: support submition of partial changes for large files

    var result = {
        type: MessageIds.TERN_FILE_INFO_TYPE_FULL,
        name: editor.getUri(),
        text: editor.getText()
    };
    return result;

    // var start = editor.cursors[0],
    //     end = start,
    //     isHtmlFile = false,
    //     result;

    // if (isHtmlFile) {
    //     result = {
    //         type: MessageIds.TERN_FILE_INFO_TYPE_FULL,
    //         name: path,
    //         text: session.getJavascriptText()
    //     };
    // }
    // if (!documentChanges) {
    //     result = {
    //         type: MessageIds.TERN_FILE_INFO_TYPE_EMPTY,
    //         name: path,
    //         text: ""
    //     };
    // } else if (session.editor.lineCount() > LARGE_LINE_COUNT &&
    //     (documentChanges.to - documentChanges.from < LARGE_LINE_CHANGE) &&
    //     documentChanges.from <= start.line &&
    //     documentChanges.to > end.line) {
    //     result = getFragmentAround(session, start);
    // } else {

    // submit the full doc as we do now...

    //}

    //documentChanges = null;
}

/**
 * Get the completions for the given offset
 *
 * @param {{type: string, name: string, offsetLines: number, text: string}} fileInfo
 * - type of update, name of file, and the text of the update.
 * For "full" updates, the whole text of the file is present. For "part" updates,
 * the changed portion of the text. For "empty" updates, the file has not been modified
 * and the text is empty.
 * @param {{line: number, ch: number}} offset -
 * the offset into the file where we want completions for
 * @param {boolean} isProperty - true if getting a property hint,
 * otherwise getting an identifier hint.
 */
function getTernHints(fileInfo, offset, isProperty, prefix, callback) {

    var request = new TernRequest(fileInfo, "completions", offset),
        i;

    //_log("request " + dir + " " + file + " " + offset /*+ " " + text */);
    TernServer.request(request, function(error, data) {
        var completions = [];
        if (error) {
            _log("Error returned from Tern 'completions' request: " + error);
        } else {
            //_log("found " + data.completions.length + " for " + file + "@" + offset);
            for (i = 0; i < data.completions.length; ++i) {
                var completion = data.completions[i];
                completions.push({
                    word: completion.name,
                    prefix: prefix,
                    type: completion.type,
                    depth: completion.depth,
                    guess: completion.guess,
                    origin: completion.origin
                });
            }
        }

        if (completions.length > 0 || !isProperty) {
            callback(completions);
        } else {
            // if there are no completions, then get all the properties
            getTernProperties(fileInfo, offset, MessageIds.TERN_COMPLETIONS_MSG, prefix, callback);
        }
    });
}

/**
 *  Given a Tern type object, convert it to an array of Objects, where each object describes
 *  a parameter.
 *
 * @param {!Infer.Fn} inferFnType - type to convert.
 * @return {Array<{name: string, type: string, isOptional: boolean}>} where each entry in the array is a parameter.
 */
function getParameters(inferFnType) {

    // work around define functions before use warning.
    var recordTypeToString, inferTypeToString, processInferFnTypeParameters, inferFnTypeToString;

    /**
     *  Convert an infer array type to a string.
     *
     *  Formatted using google closure style. For example:
     *
     *  "Array.<string, number>"
     *
     * @param {Infer.Arr} inferArrType
     *
     * @return {string} - array formatted in google closure style.
     *
     */
    function inferArrTypeToString(inferArrType) {
        var result = "Array.<";

        inferArrType.props["<i>"].types.forEach(function(value, i) {
            if (i > 0) {
                result += ", ";
            }
            result += inferTypeToString(value);
        });

        // workaround case where types is zero length
        if (inferArrType.props["<i>"].types.length === 0) {
            result += "Object";
        }
        result += ">";

        return result;
    }

    /**
     * Convert properties to a record type annotation.
     *
     * @param {Object} props
     * @return {string} - record type annotation
     */
    recordTypeToString = function(props) {
        var result = "{",
            first = true,
            prop;

        for (prop in props) {
            if (Object.prototype.hasOwnProperty.call(props, prop)) {
                if (!first) {
                    result += ", ";
                }

                first = false;
                result += prop + ": " + inferTypeToString(props[prop]);
            }
        }

        result += "}";

        return result;
    };

    /**
     *  Convert an infer type to a string.
     *
     * @param {*} inferType - one of the Infer's types; Infer.Prim, Infer.Arr, Infer.ANull. Infer.Fn functions are
     * not handled here.
     *
     * @return {string}
     *
     */
    inferTypeToString = function(inferType) {
        var result;

        if (inferType instanceof Infer.AVal) {
            inferType = inferType.types[0];
        }

        if (inferType instanceof Infer.Prim) {
            result = inferType.toString();
            if (result === "string") {
                result = "String";
            } else if (result === "number") {
                result = "Number";
            } else if (result === "boolean") {
                result = "Boolean";
            }
        } else if (inferType instanceof Infer.Arr) {
            result = inferArrTypeToString(inferType);
        } else if (inferType instanceof Infer.Fn) {
            result = inferFnTypeToString(inferType);
        } else if (inferType instanceof Infer.Obj) {
            if (inferType.name === undefined) {
                result = recordTypeToString(inferType.props);
            } else {
                result = inferType.name;
            }
        } else {
            result = "Object";
        }

        return result;
    };

    /**
     * Convert an infer function type to a Google closure type string.
     *
     * @param {Infer.Fn} inferType - type to convert.
     * @return {string} - function type as a string.
     */
    inferFnTypeToString = function(inferType) {
        var result = "function(",
            params = processInferFnTypeParameters(inferType);

        result += HintUtils2.formatParameterHint(params, null, null, true);
        if (inferType.retval) {
            result += "):";
            result += inferTypeToString(inferType.retval);
        }

        return result;
    };

    /**
     * Convert an infer function type to string.
     *
     * @param {*} inferType - one of the Infer's types; Infer.Fn, Infer.Prim, Infer.Arr, Infer.ANull
     * @return {Array<{name: string, type: string, isOptional: boolean}>} where each entry in the array is a parameter.
     */
    processInferFnTypeParameters = function(inferType) {
        var params = [],
            i;

        for (i = 0; i < inferType.args.length; i++) {
            var param = {},
                name = inferType.argNames[i],
                type = inferType.args[i];

            if (!name) {
                name = "param" + (i + 1);
            }

            if (name[name.length - 1] === "?") {
                name = name.substring(0, name.length - 1);
                param.isOptional = true;
            }

            param.name = name;
            param.type = inferTypeToString(type);
            params.push(param);
        }

        return params;
    };

    return processInferFnTypeParameters(inferFnType);
}

/**
 * Get the function type for the given offset
 *
 * @param {{type: string, name: string, offsetLines: number, text: string}} fileInfo
 * - type of update, name of file, and the text of the update.
 * For "full" updates, the whole text of the file is present. For "part" updates,
 * the changed portion of the text. For "empty" updates, the file has not been modified
 * and the text is empty.
 * @param {{line: number, ch: number}} offset -
 * the offset into the file where we want completions for
 */
function handleFunctionType(fileInfo, offset) {
    var request = new TernRequest(fileInfo, "type", offset),
        error;

    request.query.preferFunction = true;

    var fnType = "";
    try {
        TernServer.request(request, function(ternError, data) {

            if (ternError) {
                _log("Error for Tern request: \n" + JSON.stringify(request) + "\n" + ternError);
                error = ternError.toString();
            } else {
                var file = TernServer.findFile(fileInfo.name);

                // convert query from partial to full offsets
                var newOffset = offset;
                if (fileInfo.type === MessageIds.TERN_FILE_INFO_TYPE_PART) {
                    newOffset = {
                        line: offset.line + fileInfo.offsetLines,
                        ch: offset.ch
                    };
                }

                request = new TernRequest(createEmptyUpdate(fileInfo.name), "type", newOffset);

                // var expr = Tern.findQueryExpr(file, request.query);
                // Infer.resetGuessing();
                // var type = Infer.expressionType(expr);
                // type = type.getFunctionType() || type.getType();
                //
                // if (type) {
                //     fnType = getParameters(type);
                // } else {
                //     ternError = "No parameter type found";
                //     _log(ternError);
                // }
            }
        });
    } catch (e) {
        error = e.message;
        _log("Error thrown in tern_worker:" + error + "\n" + e.stack);
    }

    // Post a message back to the main thread with the completions
    self.postMessage({
        type: MessageIds.TERN_CALLED_FUNC_TYPE_MSG,
        file: fileInfo.name,
        offset: offset,
        fnType: fnType,
        error: error
    });
}

/**
 *  Update the context of a file in tern.
 *
 * @param {string} path - full path of file.
 * @param {string} text - content of the file.
 */
function handleUpdateFile(path, text) {

    TernServer.addFile(path, text);

    self.postMessage({
        type: MessageIds.TERN_UPDATE_FILE_MSG,
        path: path
    });

    // reset to get the best hints with the updated file.
    TernServer.reset();
}

/**
 *  Make a completions request to tern to force tern to resolve files
 *  and create a fast first lookup for the user.
 * @param {string} path     - the path of the file
 */
function handlePrimePump(path) {
    var fileInfo = createEmptyUpdate(path);
    var request = new TernRequest(fileInfo, "completions", {
        line: 0,
        ch: 0
    });

    TernServer.request(request, function(error, data) {
        // Post a message back to the main thread
        self.postMessage({
            type: MessageIds.TERN_PRIME_PUMP_MSG,
            path: path
        });
    });
}

/**
 * @return {{line:number, ch:number}} - the line, col info for where the previous "."
 *      in a property lookup occurred, or undefined if no previous "." was found.
 */
function findPreviousDot(editor, cursor) {
    var token = cursor.getCurrentWordPrefix();

    // If the cursor is right after the dot, then the current token will be "."
    if (token && token === ".") {
        var cursorPos = cursor.getScreenPosition();
        return {
            line: cursorPos.row,
            ch: cursorPos.column
        };
    } else {
        // If something has been typed like 'foo.b' then we have to look back 2 tokens
        // to get past the 'b' token
        token = getPreviousToken(editor, cursor);
        if (token && token === ".") {
            return {
                line: 1,
                ch: 1
            };
        }
    }
    return false;
}

/**
 * Get the token before the one at the given cursor position
 *
 * @param {{line: number, ch: number}} cursor - cursor position after
 *      which a token should be retrieved
 * @return {Object} - the CodeMirror token before the one at the given
 *      cursor position
 */
function getPreviousToken(editor, cursor) {
    var token = cursor.getCurrentWordPrefix(),
        prev = '',
        doc = editor.getText();

    do {
        prev = '.';
        // iterate back to see the whole line
    } while (prev.trim() === "");

    return {
        line: 1,
        ch: 1
    };
}

module.exports = {
    configDefaults: {
        liveCompletion: false,
        includeCompletionsFromAllBuffers: false,
        fileBlacklist: ".*, *.md"
    },
    autocompleteViews: [],
    editorSubscription: null,
    activate: function(state) {
        var self = this;

        self.editorSubscription = atom.workspaceView.eachEditorView(function(editor) {
            if (editor.attached && !editor.mini) {

                var autocompleteView = new AutocompleteView(editor);

                editor.on('editor:will-be-removed', function() {
                    if (!autocompleteView.hasParent()) {
                        autocompleteView.remove();
                    }
                    var index = self.autocompleteViews.indexOf(autocompleteView);
                    if (index > -1) {
                        self.autocompleteViews.splice(index, 1);
                    }
                });
                return self.autocompleteViews.push(autocompleteView);
            }
        });

        TernServer.init();
        this.autocompleteViews[0].setCustomGetSugestions(requestHints);
    },
    deactivate: function() {
        if (this.editorSubscription) {
            this.editorSubscription.off();
            this.editorSubscription = null;
        }
        this.autocompleteViews.forEach(function(autocompleteView) {
            autocompleteView.remove();
        });
        this.autocompleteViews = [];
    }
};