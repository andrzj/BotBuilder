"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Prompt_1 = require("./Prompt");
var PromptRecognizers_1 = require("./PromptRecognizers");
var Message_1 = require("../Message");
var Keyboard_1 = require("../cards/Keyboard");
var consts = require("../consts");
var Channel = require("../Channel");
var PromptChoice = (function (_super) {
    __extends(PromptChoice, _super);
    function PromptChoice(features) {
        var _this = _super.call(this, {
            defaultRetryPrompt: 'default_choice',
            defaultRetryNamespace: consts.Library.system,
            recognizeNumbers: true,
            recognizeOrdinals: true,
            recognizeChoices: true,
            defaultListStyle: Prompt_1.ListStyle.list,
            inlineListCount: 3,
            minScore: 0.4
        }) || this;
        _this._onChoices = [];
        _this.updateFeatures(features);
        _this.onRecognize(function (context, cb) {
            if (context.message.text && !_this.features.disableRecognizer) {
                _this.findChoices(context, true, function (err, choices) {
                    if (err || !choices || !choices.length) {
                        return cb(err, 0.0);
                    }
                    var topScore = 0.0;
                    var topMatch = null;
                    var utterance = context.message.text.trim();
                    if (_this.features.recognizeChoices) {
                        var options = { allowPartialMatches: true };
                        var match = PromptRecognizers_1.PromptRecognizers.findTopEntity(PromptRecognizers_1.PromptRecognizers.recognizeChoices(utterance, choices, options));
                        if (match) {
                            topScore = match.score;
                            topMatch = match.entity;
                        }
                    }
                    if (_this.features.recognizeNumbers) {
                        var options = { minValue: 1, maxValue: choices.length, integerOnly: true };
                        var match = PromptRecognizers_1.PromptRecognizers.findTopEntity(PromptRecognizers_1.PromptRecognizers.recognizeNumbers(context, options));
                        if (match && match.score > topScore) {
                            var index = Math.floor(match.entity - 1);
                            topScore = match.score;
                            topMatch = {
                                score: match.score,
                                index: index,
                                entity: choices[index].value
                            };
                        }
                    }
                    if (_this.features.recognizeOrdinals) {
                        var match = PromptRecognizers_1.PromptRecognizers.findTopEntity(PromptRecognizers_1.PromptRecognizers.recognizeOrdinals(context));
                        if (match && match.score > topScore) {
                            var index = match.entity > 0 ? match.entity - 1 : choices.length - match.entity;
                            if (index >= 0 && index < choices.length) {
                                topScore = match.score;
                                topMatch = {
                                    score: match.score,
                                    index: index,
                                    entity: choices[index].value
                                };
                            }
                        }
                    }
                    if (topScore >= _this.features.minScore && topScore > 0) {
                        cb(null, topScore, topMatch);
                    }
                    else {
                        cb(null, 0.0);
                    }
                });
            }
            else {
                cb(null, 0.0);
            }
        });
        _this.onFormatMessage(function (session, text, speak, callback) {
            var context = session.dialogData;
            var options = context.options;
            _this.findChoices(session.toRecognizeContext(), false, function (err, choices) {
                var msg;
                if (!err && choices) {
                    var listStyle = options.listStyle;
                    if (listStyle === undefined || listStyle === null || listStyle === Prompt_1.ListStyle.auto) {
                        if (Channel.supportsKeyboards(session, choices.length)) {
                            listStyle = Prompt_1.ListStyle.button;
                        }
                        else {
                            listStyle = _this.features.defaultListStyle;
                            var inlineListCount = _this.features.inlineListCount;
                            if (listStyle === Prompt_1.ListStyle.list && inlineListCount > 0 && choices.length <= inlineListCount) {
                                listStyle = Prompt_1.ListStyle.inline;
                            }
                        }
                    }
                    var keyboardsOnly = context.turns > 0;
                    msg = PromptChoice.formatMessage(session, listStyle, text, speak, choices, keyboardsOnly);
                }
                callback(err, msg);
            });
        });
        _this.matches(consts.Intents.Repeat, function (session) {
            session.dialogData.turns = 0;
            _this.sendPrompt(session);
        });
        return _this;
    }
    PromptChoice.prototype.findChoices = function (context, recognizePhase, callback) {
        var idx = 0;
        var handlers = this._onChoices;
        function next(err, choices) {
            if (err || choices) {
                callback(err, choices);
            }
            else {
                try {
                    if (idx < handlers.length) {
                        handlers[idx++](context, next, recognizePhase);
                    }
                    else {
                        choices = context.dialogData.options.choices || [];
                        callback(null, choices);
                    }
                }
                catch (e) {
                    callback(e, null);
                }
            }
        }
        next(null, null);
    };
    PromptChoice.prototype.onChoices = function (handler) {
        this._onChoices.unshift(handler);
        return this;
    };
    PromptChoice.formatMessage = function (session, listStyle, text, speak, choices, keyboardsOnly) {
        if (keyboardsOnly === void 0) { keyboardsOnly = false; }
        var options = session.dialogData.options;
        var locale = session.preferredLocale();
        var namespace = options ? options.libraryNamespace : null;
        var msg = new Message_1.Message(session);
        if (speak) {
            msg.speak(session.localizer.gettext(locale, Message_1.Message.randomPrompt(speak), namespace));
        }
        var txt = session.localizer.gettext(locale, Message_1.Message.randomPrompt(text), namespace);
        if (choices && choices.length > 0) {
            var values_1 = [];
            var actions_1 = [];
            choices.forEach(function (choice) {
                if (listStyle == Prompt_1.ListStyle.button) {
                    if (choice.action) {
                        actions_1.push(choice.action);
                    }
                    else {
                        actions_1.push({
                            type: 'imBack',
                            title: choice.value,
                            value: choice.value
                        });
                    }
                }
                else {
                    values_1.push(choice.value);
                }
            });
            var connector_1 = '';
            switch (listStyle) {
                case Prompt_1.ListStyle.button:
                    if (actions_1.length > 0) {
                        var keyboard = new Keyboard_1.Keyboard().buttons(actions_1);
                        msg.addAttachment(keyboard);
                    }
                    break;
                case Prompt_1.ListStyle.inline:
                    if (values_1.length > 0 && !keyboardsOnly) {
                        txt += ' (';
                        values_1.forEach(function (v, index) {
                            txt += connector_1 + (index + 1) + '. ' + v;
                            if (index == (values_1.length - 2)) {
                                var cid = index == 0 ? 'list_or' : 'list_or_more';
                                connector_1 = Prompt_1.Prompt.gettext(session, cid, consts.Library.system);
                            }
                            else {
                                connector_1 = ', ';
                            }
                        });
                        txt += ')';
                    }
                    break;
                case Prompt_1.ListStyle.list:
                    if (values_1.length > 0 && !keyboardsOnly) {
                        txt += '\n\n   ';
                        values_1.forEach(function (v, index) {
                            txt += connector_1 + (index + 1) + '. ' + v;
                            connector_1 = '\n   ';
                        });
                    }
                    break;
            }
        }
        return msg.text(txt).toMessage();
    };
    return PromptChoice;
}(Prompt_1.Prompt));
exports.PromptChoice = PromptChoice;
