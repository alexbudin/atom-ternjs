"use strict";

var Tern = require('tern'),
    fs = require('fs'),
    ternServer = null,
    MAX_HINTS = 30, // how often to reset the tern server
    LARGE_LINE_CHANGE = 100,
    LARGE_LINE_COUNT = 2000,
    MessageIds = {
        TERN_ADD_FILES_MSG: "AddFiles",
        TERN_UPDATE_FILE_MSG: "UpdateFile",
        TERN_INIT_MSG: "Init",
        TERN_JUMPTODEF_MSG: "JumptoDef",
        TERN_COMPLETIONS_MSG: "Completions",
        TERN_GET_FILE_MSG: "GetFile",
        TERN_CALLED_FUNC_TYPE_MSG: "FunctionType",
        TERN_PRIME_PUMP_MSG: "PrimePump",
        TERN_GET_GUESSES_MSG: "GetGuesses",
        TERN_WORKER_READY: "WorkerReady",
        SET_CONFIG: "SetConfig",

        // Message parameter constants
        TERN_FILE_INFO_TYPE_PART: "part",
        TERN_FILE_INFO_TYPE_FULL: "full",
        TERN_FILE_INFO_TYPE_EMPTY: "empty"
    };

function initTernServer(env) {
    var ternOptions = {
        //defs: env,
        async: false,
        getFile: getFile,
        plugins: {
            requirejs: {},
            doc_comment: true,
            angular: true
        }
    };
    ternServer = new Tern.Server(ternOptions);

    if (atom.project.getPath()) {
        atom.project.scan('/^.+\.((?:[jJ][sS]))$/', {}, function(data) {
            ternServer.addFile(data.filePath);
        });
    } else {
        // do something with the single file...
    }
}

/**
 * Our logging method...
 *
 * @param {string} msg - the log message
 */
function _log(msg) {
    console.log(msg);
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
    var request = buildRequest(fileInfo, "definition", offset);
    // request.query.typeOnly = true;       // FIXME: tern doesn't work exactly right yet.
    ternServer.request(request, function(error, data) {
        if (error) {
            _log("Error returned from Tern 'definition' request: " + error);
            self.postMessage({
                type: MessageIds.TERN_JUMPTODEF_MSG,
                file: fileInfo.name,
                offset: offset
            });
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

        request = buildRequest(fileInfo, "type", offset);
        // See if we can tell if the reference is to a Function type
        ternServer.request(request, function(error, data) {
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
function requestHints(editor) {
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

    hintPromise = getTernHints(fileInfo, {
        line: cursorPos.row,
        ch: cursorPos.column
    }, propertyLookup);

    // TODO: do something with hintPromise to display the hints

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
function getTernProperties(fileInfo, offset, type) {

    var request = buildRequest(fileInfo, "properties", offset),
        i;
    //_log("tern properties: request " + request.type + dir + " " + file);
    ternServer.request(request, function(error, data) {
        var properties = [];
        if (error) {
            _log("Error returned from Tern 'properties' request: " + error);
        } else {
            //_log("tern properties: completions = " + data.completions.length);
            for (i = 0; i < data.completions.length; ++i) {
                var property = data.completions[i];
                properties.push({
                    value: property,
                    type: property.type,
                    guess: true
                });
            }
        }

        // Post a message back to the main thread with the completions
        self.postMessage({
            type: type,
            file: fileInfo.name,
            offset: offset,
            properties: properties
        });
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
function getTernHints(fileInfo, offset, isProperty) {

    var request = buildRequest(fileInfo, "completions", offset),
        i;

    //_log("request " + dir + " " + file + " " + offset /*+ " " + text */);
    ternServer.request(request, function(error, data) {
        var completions = [];
        if (error) {
            _log("Error returned from Tern 'completions' request: " + error);
        } else {
            //_log("found " + data.completions.length + " for " + file + "@" + offset);
            for (i = 0; i < data.completions.length; ++i) {
                var completion = data.completions[i];
                completions.push({
                    value: completion.name,
                    type: completion.type,
                    depth: completion.depth,
                    guess: completion.guess,
                    origin: completion.origin
                });
            }
        }

        if (completions.length > 0 || !isProperty) {
            console.log(completions);
            // TODO: do something with the hints...
            //
            // self.postMessage({
            //     type: MessageIds.TERN_COMPLETIONS_MSG,
            //     file: fileInfo.name,
            //     offset: offset,
            //     completions: completions
            // });
        } else {
            // if there are no completions, then get all the properties
            getTernProperties(fileInfo, offset, MessageIds.TERN_COMPLETIONS_MSG);
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
    var request = buildRequest(fileInfo, "type", offset),
        error;

    request.query.preferFunction = true;

    var fnType = "";
    try {
        ternServer.request(request, function(ternError, data) {

            if (ternError) {
                _log("Error for Tern request: \n" + JSON.stringify(request) + "\n" + ternError);
                error = ternError.toString();
            } else {
                var file = ternServer.findFile(fileInfo.name);

                // convert query from partial to full offsets
                var newOffset = offset;
                if (fileInfo.type === MessageIds.TERN_FILE_INFO_TYPE_PART) {
                    newOffset = {
                        line: offset.line + fileInfo.offsetLines,
                        ch: offset.ch
                    };
                }

                request = buildRequest(createEmptyUpdate(fileInfo.name), "type", newOffset);

                var expr = Tern.findQueryExpr(file, request.query);
                Infer.resetGuessing();
                var type = Infer.expressionType(expr);
                type = type.getFunctionType() || type.getType();

                if (type) {
                    fnType = getParameters(type);
                } else {
                    ternError = "No parameter type found";
                    _log(ternError);
                }
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
 * Provide the contents of the requested file to tern
 * @param {string} name - the name of the file
 * @param {Function} next - the function to call with the text of the file
 *  once it has been read in.
 */
function getFile(name) {
    return fs.readFileSync(name);
}


/**
 *  Update the context of a file in tern.
 *
 * @param {string} path - full path of file.
 * @param {string} text - content of the file.
 */
function handleUpdateFile(path, text) {

    ternServer.addFile(path, text);

    self.postMessage({
        type: MessageIds.TERN_UPDATE_FILE_MSG,
        path: path
    });

    // reset to get the best hints with the updated file.
    ternServer.reset();
}

/**
 *  Make a completions request to tern to force tern to resolve files
 *  and create a fast first lookup for the user.
 * @param {string} path     - the path of the file
 */
function handlePrimePump(path) {
    var fileInfo = createEmptyUpdate(path);
    var request = buildRequest(fileInfo, "completions", {
        line: 0,
        ch: 0
    });

    ternServer.request(request, function(error, data) {
        // Post a message back to the main thread
        self.postMessage({
            type: MessageIds.TERN_PRIME_PUMP_MSG,
            path: path
        });
    });
}

/**
 * Build an object that can be used as a request to tern.
 *
 * @param {{type: string, name: string, offsetLines: number, text: string}} fileInfo
 * - type of update, name of file, and the text of the update.
 * For "full" updates, the whole text of the file is present. For "part" updates,
 * the changed portion of the text. For "empty" updates, the file has not been modified
 * and the text is empty.
 * @param {string} query - the type of request being made
 * @param {{line: number, ch: number}} offset -
 */
function buildRequest(fileInfo, query, offset) {
    query = {
        type: query
    };
    query.start = offset;
    query.end = offset;
    query.file = (fileInfo.type === MessageIds.TERN_FILE_INFO_TYPE_PART) ? "#0" : fileInfo.name;
    query.filter = false;
    query.sort = false;
    query.depths = true;
    query.guess = true;
    query.origins = true;
    query.types = true;
    query.expandWordForward = false;
    query.lineCharPositions = true;

    var request = {
        query: query,
        files: [],
        offset: offset
    };
    if (fileInfo.type !== MessageIds.TERN_FILE_INFO_TYPE_EMPTY) {
        request.files.push(fileInfo);
    }

    return request;
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
};

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
};

module.exports = {
    activate: function(state) {
        initTernServer();

        atom.workspaceView.eachEditorView(function(e) {
            var editor = e.getEditor();
            (function(editor) {
                editor.on("contents-modified", function() {
                    process.nextTick(function() {
                        requestHints(editor);
                        console.log(editor.getUri());
                        console.log("this returns no data so we will need to fetch the data we need");
                    });
                });
            })(editor);
        });
    },
    deactivate: function() {

    }
};