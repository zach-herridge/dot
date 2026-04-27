#!/usr/bin/env bun
// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = import.meta.require;

// node_modules/commander/lib/error.js
var require_error = __commonJS((exports) => {
  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
      this.nestedError = undefined;
    }
  }

  class InvalidArgumentError extends CommanderError {
    constructor(message) {
      super(1, "commander.invalidArgument", message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
    }
  }
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
});

// node_modules/commander/lib/argument.js
var require_argument = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Argument {
    constructor(name, description) {
      this.description = description || "";
      this.variadic = false;
      this.parseArg = undefined;
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.argChoices = undefined;
      switch (name[0]) {
        case "<":
          this.required = true;
          this._name = name.slice(1, -1);
          break;
        case "[":
          this.required = false;
          this._name = name.slice(1, -1);
          break;
        default:
          this.required = true;
          this._name = name;
          break;
      }
      if (this._name.length > 3 && this._name.slice(-3) === "...") {
        this.variadic = true;
        this._name = this._name.slice(0, -3);
      }
    }
    name() {
      return this._name;
    }
    _concatValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      return previous.concat(value);
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._concatValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    argRequired() {
      this.required = true;
      return this;
    }
    argOptional() {
      this.required = false;
      return this;
    }
  }
  function humanReadableArgName(arg) {
    const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  exports.Argument = Argument;
  exports.humanReadableArgName = humanReadableArgName;
});

// node_modules/commander/lib/help.js
var require_help = __commonJS((exports) => {
  var { humanReadableArgName } = require_argument();

  class Help {
    constructor() {
      this.helpWidth = undefined;
      this.minWidthToWrap = 40;
      this.sortSubcommands = false;
      this.sortOptions = false;
      this.showGlobalOptions = false;
    }
    prepareContext(contextOptions) {
      this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
    }
    visibleCommands(cmd) {
      const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
      const helpCommand = cmd._getHelpCommand();
      if (helpCommand && !helpCommand._hidden) {
        visibleCommands.push(helpCommand);
      }
      if (this.sortSubcommands) {
        visibleCommands.sort((a, b) => {
          return a.name().localeCompare(b.name());
        });
      }
      return visibleCommands;
    }
    compareOptions(a, b) {
      const getSortKey = (option) => {
        return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
      };
      return getSortKey(a).localeCompare(getSortKey(b));
    }
    visibleOptions(cmd) {
      const visibleOptions = cmd.options.filter((option) => !option.hidden);
      const helpOption = cmd._getHelpOption();
      if (helpOption && !helpOption.hidden) {
        const removeShort = helpOption.short && cmd._findOption(helpOption.short);
        const removeLong = helpOption.long && cmd._findOption(helpOption.long);
        if (!removeShort && !removeLong) {
          visibleOptions.push(helpOption);
        } else if (helpOption.long && !removeLong) {
          visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
        } else if (helpOption.short && !removeShort) {
          visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
        }
      }
      if (this.sortOptions) {
        visibleOptions.sort(this.compareOptions);
      }
      return visibleOptions;
    }
    visibleGlobalOptions(cmd) {
      if (!this.showGlobalOptions)
        return [];
      const globalOptions = [];
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
        globalOptions.push(...visibleOptions);
      }
      if (this.sortOptions) {
        globalOptions.sort(this.compareOptions);
      }
      return globalOptions;
    }
    visibleArguments(cmd) {
      if (cmd._argsDescription) {
        cmd.registeredArguments.forEach((argument) => {
          argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
        });
      }
      if (cmd.registeredArguments.find((argument) => argument.description)) {
        return cmd.registeredArguments;
      }
      return [];
    }
    subcommandTerm(cmd) {
      const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
      return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
    }
    optionTerm(option) {
      return option.flags;
    }
    argumentTerm(argument) {
      return argument.name();
    }
    longestSubcommandTermLength(cmd, helper) {
      return helper.visibleCommands(cmd).reduce((max, command) => {
        return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
      }, 0);
    }
    longestOptionTermLength(cmd, helper) {
      return helper.visibleOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestGlobalOptionTermLength(cmd, helper) {
      return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestArgumentTermLength(cmd, helper) {
      return helper.visibleArguments(cmd).reduce((max, argument) => {
        return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
      }, 0);
    }
    commandUsage(cmd) {
      let cmdName = cmd._name;
      if (cmd._aliases[0]) {
        cmdName = cmdName + "|" + cmd._aliases[0];
      }
      let ancestorCmdNames = "";
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
      }
      return ancestorCmdNames + cmdName + " " + cmd.usage();
    }
    commandDescription(cmd) {
      return cmd.description();
    }
    subcommandDescription(cmd) {
      return cmd.summary() || cmd.description();
    }
    optionDescription(option) {
      const extraInfo = [];
      if (option.argChoices) {
        extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (option.defaultValue !== undefined) {
        const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
        if (showDefault) {
          extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
      }
      if (option.envVar !== undefined) {
        extraInfo.push(`env: ${option.envVar}`);
      }
      if (extraInfo.length > 0) {
        return `${option.description} (${extraInfo.join(", ")})`;
      }
      return option.description;
    }
    argumentDescription(argument) {
      const extraInfo = [];
      if (argument.argChoices) {
        extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (argument.description) {
          return `${argument.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return argument.description;
    }
    formatHelp(cmd, helper) {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth ?? 80;
      function callFormatItem(term, description) {
        return helper.formatItem(term, termWidth, description, helper);
      }
      let output = [
        `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
        ""
      ];
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0) {
        output = output.concat([
          helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth),
          ""
        ]);
      }
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return callFormatItem(helper.styleArgumentTerm(helper.argumentTerm(argument)), helper.styleArgumentDescription(helper.argumentDescription(argument)));
      });
      if (argumentList.length > 0) {
        output = output.concat([
          helper.styleTitle("Arguments:"),
          ...argumentList,
          ""
        ]);
      }
      const optionList = helper.visibleOptions(cmd).map((option) => {
        return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
      });
      if (optionList.length > 0) {
        output = output.concat([
          helper.styleTitle("Options:"),
          ...optionList,
          ""
        ]);
      }
      if (helper.showGlobalOptions) {
        const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        if (globalOptionList.length > 0) {
          output = output.concat([
            helper.styleTitle("Global Options:"),
            ...globalOptionList,
            ""
          ]);
        }
      }
      const commandList = helper.visibleCommands(cmd).map((cmd2) => {
        return callFormatItem(helper.styleSubcommandTerm(helper.subcommandTerm(cmd2)), helper.styleSubcommandDescription(helper.subcommandDescription(cmd2)));
      });
      if (commandList.length > 0) {
        output = output.concat([
          helper.styleTitle("Commands:"),
          ...commandList,
          ""
        ]);
      }
      return output.join(`
`);
    }
    displayWidth(str) {
      return stripColor(str).length;
    }
    styleTitle(str) {
      return str;
    }
    styleUsage(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word === "[command]")
          return this.styleSubcommandText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleCommandText(word);
      }).join(" ");
    }
    styleCommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleOptionDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleSubcommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleArgumentDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleDescriptionText(str) {
      return str;
    }
    styleOptionTerm(str) {
      return this.styleOptionText(str);
    }
    styleSubcommandTerm(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleSubcommandText(word);
      }).join(" ");
    }
    styleArgumentTerm(str) {
      return this.styleArgumentText(str);
    }
    styleOptionText(str) {
      return str;
    }
    styleArgumentText(str) {
      return str;
    }
    styleSubcommandText(str) {
      return str;
    }
    styleCommandText(str) {
      return str;
    }
    padWidth(cmd, helper) {
      return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
    }
    preformatted(str) {
      return /\n[^\S\r\n]/.test(str);
    }
    formatItem(term, termWidth, description, helper) {
      const itemIndent = 2;
      const itemIndentStr = " ".repeat(itemIndent);
      if (!description)
        return itemIndentStr + term;
      const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
      const spacerWidth = 2;
      const helpWidth = this.helpWidth ?? 80;
      const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
      let formattedDescription;
      if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
        formattedDescription = description;
      } else {
        const wrappedDescription = helper.boxWrap(description, remainingWidth);
        formattedDescription = wrappedDescription.replace(/\n/g, `
` + " ".repeat(termWidth + spacerWidth));
      }
      return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
    }
    boxWrap(str, width) {
      if (width < this.minWidthToWrap)
        return str;
      const rawLines = str.split(/\r\n|\n/);
      const chunkPattern = /[\s]*[^\s]+/g;
      const wrappedLines = [];
      rawLines.forEach((line) => {
        const chunks = line.match(chunkPattern);
        if (chunks === null) {
          wrappedLines.push("");
          return;
        }
        let sumChunks = [chunks.shift()];
        let sumWidth = this.displayWidth(sumChunks[0]);
        chunks.forEach((chunk) => {
          const visibleWidth = this.displayWidth(chunk);
          if (sumWidth + visibleWidth <= width) {
            sumChunks.push(chunk);
            sumWidth += visibleWidth;
            return;
          }
          wrappedLines.push(sumChunks.join(""));
          const nextChunk = chunk.trimStart();
          sumChunks = [nextChunk];
          sumWidth = this.displayWidth(nextChunk);
        });
        wrappedLines.push(sumChunks.join(""));
      });
      return wrappedLines.join(`
`);
    }
  }
  function stripColor(str) {
    const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
    return str.replace(sgrPattern, "");
  }
  exports.Help = Help;
  exports.stripColor = stripColor;
});

// node_modules/commander/lib/option.js
var require_option = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Option {
    constructor(flags, description) {
      this.flags = flags;
      this.description = description || "";
      this.required = flags.includes("<");
      this.optional = flags.includes("[");
      this.variadic = /\w\.\.\.[>\]]$/.test(flags);
      this.mandatory = false;
      const optionFlags = splitOptionFlags(flags);
      this.short = optionFlags.shortFlag;
      this.long = optionFlags.longFlag;
      this.negate = false;
      if (this.long) {
        this.negate = this.long.startsWith("--no-");
      }
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.presetArg = undefined;
      this.envVar = undefined;
      this.parseArg = undefined;
      this.hidden = false;
      this.argChoices = undefined;
      this.conflictsWith = [];
      this.implied = undefined;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    preset(arg) {
      this.presetArg = arg;
      return this;
    }
    conflicts(names) {
      this.conflictsWith = this.conflictsWith.concat(names);
      return this;
    }
    implies(impliedOptionValues) {
      let newImplied = impliedOptionValues;
      if (typeof impliedOptionValues === "string") {
        newImplied = { [impliedOptionValues]: true };
      }
      this.implied = Object.assign(this.implied || {}, newImplied);
      return this;
    }
    env(name) {
      this.envVar = name;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    makeOptionMandatory(mandatory = true) {
      this.mandatory = !!mandatory;
      return this;
    }
    hideHelp(hide = true) {
      this.hidden = !!hide;
      return this;
    }
    _concatValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      return previous.concat(value);
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._concatValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    name() {
      if (this.long) {
        return this.long.replace(/^--/, "");
      }
      return this.short.replace(/^-/, "");
    }
    attributeName() {
      if (this.negate) {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      return camelcase(this.name());
    }
    is(arg) {
      return this.short === arg || this.long === arg;
    }
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }

  class DualOptions {
    constructor(options) {
      this.positiveOptions = new Map;
      this.negativeOptions = new Map;
      this.dualOptions = new Set;
      options.forEach((option) => {
        if (option.negate) {
          this.negativeOptions.set(option.attributeName(), option);
        } else {
          this.positiveOptions.set(option.attributeName(), option);
        }
      });
      this.negativeOptions.forEach((value, key) => {
        if (this.positiveOptions.has(key)) {
          this.dualOptions.add(key);
        }
      });
    }
    valueFromOption(value, option) {
      const optionKey = option.attributeName();
      if (!this.dualOptions.has(optionKey))
        return true;
      const preset = this.negativeOptions.get(optionKey).presetArg;
      const negativeValue = preset !== undefined ? preset : false;
      return option.negate === (negativeValue === value);
    }
  }
  function camelcase(str) {
    return str.split("-").reduce((str2, word) => {
      return str2 + word[0].toUpperCase() + word.slice(1);
    });
  }
  function splitOptionFlags(flags) {
    let shortFlag;
    let longFlag;
    const shortFlagExp = /^-[^-]$/;
    const longFlagExp = /^--[^-]/;
    const flagParts = flags.split(/[ |,]+/).concat("guard");
    if (shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (longFlagExp.test(flagParts[0]))
      longFlag = flagParts.shift();
    if (!shortFlag && shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (!shortFlag && longFlagExp.test(flagParts[0])) {
      shortFlag = longFlag;
      longFlag = flagParts.shift();
    }
    if (flagParts[0].startsWith("-")) {
      const unsupportedFlag = flagParts[0];
      const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
      if (/^-[^-][^-]/.test(unsupportedFlag))
        throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
      if (shortFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many short flags`);
      if (longFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many long flags`);
      throw new Error(`${baseError}
- unrecognised flag format`);
    }
    if (shortFlag === undefined && longFlag === undefined)
      throw new Error(`option creation failed due to no flags found in '${flags}'.`);
    return { shortFlag, longFlag };
  }
  exports.Option = Option;
  exports.DualOptions = DualOptions;
});

// node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS((exports) => {
  var maxDistance = 3;
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > maxDistance)
      return Math.max(a.length, b.length);
    const d = [];
    for (let i = 0;i <= a.length; i++) {
      d[i] = [i];
    }
    for (let j = 0;j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let j = 1;j <= b.length; j++) {
      for (let i = 1;i <= a.length; i++) {
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
        } else {
          cost = 1;
        }
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }
  function suggestSimilar(word, candidates) {
    if (!candidates || candidates.length === 0)
      return "";
    candidates = Array.from(new Set(candidates));
    const searchingOptions = word.startsWith("--");
    if (searchingOptions) {
      word = word.slice(2);
      candidates = candidates.map((candidate) => candidate.slice(2));
    }
    let similar = [];
    let bestDistance = maxDistance;
    const minSimilarity = 0.4;
    candidates.forEach((candidate) => {
      if (candidate.length <= 1)
        return;
      const distance = editDistance(word, candidate);
      const length = Math.max(word.length, candidate.length);
      const similarity = (length - distance) / length;
      if (similarity > minSimilarity) {
        if (distance < bestDistance) {
          bestDistance = distance;
          similar = [candidate];
        } else if (distance === bestDistance) {
          similar.push(candidate);
        }
      }
    });
    similar.sort((a, b) => a.localeCompare(b));
    if (searchingOptions) {
      similar = similar.map((candidate) => `--${candidate}`);
    }
    if (similar.length > 1) {
      return `
(Did you mean one of ${similar.join(", ")}?)`;
    }
    if (similar.length === 1) {
      return `
(Did you mean ${similar[0]}?)`;
    }
    return "";
  }
  exports.suggestSimilar = suggestSimilar;
});

// node_modules/commander/lib/command.js
var require_command = __commonJS((exports) => {
  var EventEmitter = __require("events").EventEmitter;
  var childProcess = __require("child_process");
  var path = __require("path");
  var fs = __require("fs");
  var process2 = __require("process");
  var { Argument, humanReadableArgName } = require_argument();
  var { CommanderError } = require_error();
  var { Help, stripColor } = require_help();
  var { Option, DualOptions } = require_option();
  var { suggestSimilar } = require_suggestSimilar();

  class Command extends EventEmitter {
    constructor(name) {
      super();
      this.commands = [];
      this.options = [];
      this.parent = null;
      this._allowUnknownOption = false;
      this._allowExcessArguments = false;
      this.registeredArguments = [];
      this._args = this.registeredArguments;
      this.args = [];
      this.rawArgs = [];
      this.processedArgs = [];
      this._scriptPath = null;
      this._name = name || "";
      this._optionValues = {};
      this._optionValueSources = {};
      this._storeOptionsAsProperties = false;
      this._actionHandler = null;
      this._executableHandler = false;
      this._executableFile = null;
      this._executableDir = null;
      this._defaultCommandName = null;
      this._exitCallback = null;
      this._aliases = [];
      this._combineFlagAndOptionalValue = true;
      this._description = "";
      this._summary = "";
      this._argsDescription = undefined;
      this._enablePositionalOptions = false;
      this._passThroughOptions = false;
      this._lifeCycleHooks = {};
      this._showHelpAfterError = false;
      this._showSuggestionAfterError = true;
      this._savedState = null;
      this._outputConfiguration = {
        writeOut: (str) => process2.stdout.write(str),
        writeErr: (str) => process2.stderr.write(str),
        outputError: (str, write) => write(str),
        getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : undefined,
        getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : undefined,
        getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
        getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
        stripColor: (str) => stripColor(str)
      };
      this._hidden = false;
      this._helpOption = undefined;
      this._addImplicitHelpCommand = undefined;
      this._helpCommand = undefined;
      this._helpConfiguration = {};
    }
    copyInheritedSettings(sourceCommand) {
      this._outputConfiguration = sourceCommand._outputConfiguration;
      this._helpOption = sourceCommand._helpOption;
      this._helpCommand = sourceCommand._helpCommand;
      this._helpConfiguration = sourceCommand._helpConfiguration;
      this._exitCallback = sourceCommand._exitCallback;
      this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
      this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
      this._allowExcessArguments = sourceCommand._allowExcessArguments;
      this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
      this._showHelpAfterError = sourceCommand._showHelpAfterError;
      this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
      return this;
    }
    _getCommandAndAncestors() {
      const result = [];
      for (let command = this;command; command = command.parent) {
        result.push(command);
      }
      return result;
    }
    command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
      let desc = actionOptsOrExecDesc;
      let opts = execOpts;
      if (typeof desc === "object" && desc !== null) {
        opts = desc;
        desc = null;
      }
      opts = opts || {};
      const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const cmd = this.createCommand(name);
      if (desc) {
        cmd.description(desc);
        cmd._executableHandler = true;
      }
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      cmd._hidden = !!(opts.noHelp || opts.hidden);
      cmd._executableFile = opts.executableFile || null;
      if (args)
        cmd.arguments(args);
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd.copyInheritedSettings(this);
      if (desc)
        return this;
      return cmd;
    }
    createCommand(name) {
      return new Command(name);
    }
    createHelp() {
      return Object.assign(new Help, this.configureHelp());
    }
    configureHelp(configuration) {
      if (configuration === undefined)
        return this._helpConfiguration;
      this._helpConfiguration = configuration;
      return this;
    }
    configureOutput(configuration) {
      if (configuration === undefined)
        return this._outputConfiguration;
      Object.assign(this._outputConfiguration, configuration);
      return this;
    }
    showHelpAfterError(displayHelp = true) {
      if (typeof displayHelp !== "string")
        displayHelp = !!displayHelp;
      this._showHelpAfterError = displayHelp;
      return this;
    }
    showSuggestionAfterError(displaySuggestion = true) {
      this._showSuggestionAfterError = !!displaySuggestion;
      return this;
    }
    addCommand(cmd, opts) {
      if (!cmd._name) {
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      }
      opts = opts || {};
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      if (opts.noHelp || opts.hidden)
        cmd._hidden = true;
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd._checkForBrokenPassThrough();
      return this;
    }
    createArgument(name, description) {
      return new Argument(name, description);
    }
    argument(name, description, fn, defaultValue) {
      const argument = this.createArgument(name, description);
      if (typeof fn === "function") {
        argument.default(defaultValue).argParser(fn);
      } else {
        argument.default(fn);
      }
      this.addArgument(argument);
      return this;
    }
    arguments(names) {
      names.trim().split(/ +/).forEach((detail) => {
        this.argument(detail);
      });
      return this;
    }
    addArgument(argument) {
      const previousArgument = this.registeredArguments.slice(-1)[0];
      if (previousArgument && previousArgument.variadic) {
        throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
      }
      if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
        throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
      }
      this.registeredArguments.push(argument);
      return this;
    }
    helpCommand(enableOrNameAndArgs, description) {
      if (typeof enableOrNameAndArgs === "boolean") {
        this._addImplicitHelpCommand = enableOrNameAndArgs;
        return this;
      }
      enableOrNameAndArgs = enableOrNameAndArgs ?? "help [command]";
      const [, helpName, helpArgs] = enableOrNameAndArgs.match(/([^ ]+) *(.*)/);
      const helpDescription = description ?? "display help for command";
      const helpCommand = this.createCommand(helpName);
      helpCommand.helpOption(false);
      if (helpArgs)
        helpCommand.arguments(helpArgs);
      if (helpDescription)
        helpCommand.description(helpDescription);
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      return this;
    }
    addHelpCommand(helpCommand, deprecatedDescription) {
      if (typeof helpCommand !== "object") {
        this.helpCommand(helpCommand, deprecatedDescription);
        return this;
      }
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      return this;
    }
    _getHelpCommand() {
      const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
      if (hasImplicitHelpCommand) {
        if (this._helpCommand === undefined) {
          this.helpCommand(undefined, undefined);
        }
        return this._helpCommand;
      }
      return null;
    }
    hook(event, listener) {
      const allowedValues = ["preSubcommand", "preAction", "postAction"];
      if (!allowedValues.includes(event)) {
        throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      if (this._lifeCycleHooks[event]) {
        this._lifeCycleHooks[event].push(listener);
      } else {
        this._lifeCycleHooks[event] = [listener];
      }
      return this;
    }
    exitOverride(fn) {
      if (fn) {
        this._exitCallback = fn;
      } else {
        this._exitCallback = (err) => {
          if (err.code !== "commander.executeSubCommandAsync") {
            throw err;
          } else {}
        };
      }
      return this;
    }
    _exit(exitCode, code, message) {
      if (this._exitCallback) {
        this._exitCallback(new CommanderError(exitCode, code, message));
      }
      process2.exit(exitCode);
    }
    action(fn) {
      const listener = (args) => {
        const expectedArgsCount = this.registeredArguments.length;
        const actionArgs = args.slice(0, expectedArgsCount);
        if (this._storeOptionsAsProperties) {
          actionArgs[expectedArgsCount] = this;
        } else {
          actionArgs[expectedArgsCount] = this.opts();
        }
        actionArgs.push(this);
        return fn.apply(this, actionArgs);
      };
      this._actionHandler = listener;
      return this;
    }
    createOption(flags, description) {
      return new Option(flags, description);
    }
    _callParseArg(target, value, previous, invalidArgumentMessage) {
      try {
        return target.parseArg(value, previous);
      } catch (err) {
        if (err.code === "commander.invalidArgument") {
          const message = `${invalidArgumentMessage} ${err.message}`;
          this.error(message, { exitCode: err.exitCode, code: err.code });
        }
        throw err;
      }
    }
    _registerOption(option) {
      const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
      if (matchingOption) {
        const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
        throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
      }
      this.options.push(option);
    }
    _registerCommand(command) {
      const knownBy = (cmd) => {
        return [cmd.name()].concat(cmd.aliases());
      };
      const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
      if (alreadyUsed) {
        const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
        const newCmd = knownBy(command).join("|");
        throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
      }
      this.commands.push(command);
    }
    addOption(option) {
      this._registerOption(option);
      const oname = option.name();
      const name = option.attributeName();
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(name, option.defaultValue === undefined ? true : option.defaultValue, "default");
        }
      } else if (option.defaultValue !== undefined) {
        this.setOptionValueWithSource(name, option.defaultValue, "default");
      }
      const handleOptionValue = (val, invalidValueMessage, valueSource) => {
        if (val == null && option.presetArg !== undefined) {
          val = option.presetArg;
        }
        const oldValue = this.getOptionValue(name);
        if (val !== null && option.parseArg) {
          val = this._callParseArg(option, val, oldValue, invalidValueMessage);
        } else if (val !== null && option.variadic) {
          val = option._concatValue(val, oldValue);
        }
        if (val == null) {
          if (option.negate) {
            val = false;
          } else if (option.isBoolean() || option.optional) {
            val = true;
          } else {
            val = "";
          }
        }
        this.setOptionValueWithSource(name, val, valueSource);
      };
      this.on("option:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "cli");
      });
      if (option.envVar) {
        this.on("optionEnv:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "env");
        });
      }
      return this;
    }
    _optionEx(config, flags, description, fn, defaultValue) {
      if (typeof flags === "object" && flags instanceof Option) {
        throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
      }
      const option = this.createOption(flags, description);
      option.makeOptionMandatory(!!config.mandatory);
      if (typeof fn === "function") {
        option.default(defaultValue).argParser(fn);
      } else if (fn instanceof RegExp) {
        const regex = fn;
        fn = (val, def) => {
          const m = regex.exec(val);
          return m ? m[0] : def;
        };
        option.default(defaultValue).argParser(fn);
      } else {
        option.default(fn);
      }
      return this.addOption(option);
    }
    option(flags, description, parseArg, defaultValue) {
      return this._optionEx({}, flags, description, parseArg, defaultValue);
    }
    requiredOption(flags, description, parseArg, defaultValue) {
      return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
    }
    combineFlagAndOptionalValue(combine = true) {
      this._combineFlagAndOptionalValue = !!combine;
      return this;
    }
    allowUnknownOption(allowUnknown = true) {
      this._allowUnknownOption = !!allowUnknown;
      return this;
    }
    allowExcessArguments(allowExcess = true) {
      this._allowExcessArguments = !!allowExcess;
      return this;
    }
    enablePositionalOptions(positional = true) {
      this._enablePositionalOptions = !!positional;
      return this;
    }
    passThroughOptions(passThrough = true) {
      this._passThroughOptions = !!passThrough;
      this._checkForBrokenPassThrough();
      return this;
    }
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
        throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
      }
    }
    storeOptionsAsProperties(storeAsProperties = true) {
      if (this.options.length) {
        throw new Error("call .storeOptionsAsProperties() before adding options");
      }
      if (Object.keys(this._optionValues).length) {
        throw new Error("call .storeOptionsAsProperties() before setting option values");
      }
      this._storeOptionsAsProperties = !!storeAsProperties;
      return this;
    }
    getOptionValue(key) {
      if (this._storeOptionsAsProperties) {
        return this[key];
      }
      return this._optionValues[key];
    }
    setOptionValue(key, value) {
      return this.setOptionValueWithSource(key, value, undefined);
    }
    setOptionValueWithSource(key, value, source) {
      if (this._storeOptionsAsProperties) {
        this[key] = value;
      } else {
        this._optionValues[key] = value;
      }
      this._optionValueSources[key] = source;
      return this;
    }
    getOptionValueSource(key) {
      return this._optionValueSources[key];
    }
    getOptionValueSourceWithGlobals(key) {
      let source;
      this._getCommandAndAncestors().forEach((cmd) => {
        if (cmd.getOptionValueSource(key) !== undefined) {
          source = cmd.getOptionValueSource(key);
        }
      });
      return source;
    }
    _prepareUserArgs(argv, parseOptions) {
      if (argv !== undefined && !Array.isArray(argv)) {
        throw new Error("first parameter to parse must be array or undefined");
      }
      parseOptions = parseOptions || {};
      if (argv === undefined && parseOptions.from === undefined) {
        if (process2.versions?.electron) {
          parseOptions.from = "electron";
        }
        const execArgv = process2.execArgv ?? [];
        if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
          parseOptions.from = "eval";
        }
      }
      if (argv === undefined) {
        argv = process2.argv;
      }
      this.rawArgs = argv.slice();
      let userArgs;
      switch (parseOptions.from) {
        case undefined:
        case "node":
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
          break;
        case "electron":
          if (process2.defaultApp) {
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
          } else {
            userArgs = argv.slice(1);
          }
          break;
        case "user":
          userArgs = argv.slice(0);
          break;
        case "eval":
          userArgs = argv.slice(1);
          break;
        default:
          throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
      }
      if (!this._name && this._scriptPath)
        this.nameFromFilename(this._scriptPath);
      this._name = this._name || "program";
      return userArgs;
    }
    parse(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      this._parseCommand([], userArgs);
      return this;
    }
    async parseAsync(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      await this._parseCommand([], userArgs);
      return this;
    }
    _prepareForParse() {
      if (this._savedState === null) {
        this.saveStateBeforeParse();
      } else {
        this.restoreStateBeforeParse();
      }
    }
    saveStateBeforeParse() {
      this._savedState = {
        _name: this._name,
        _optionValues: { ...this._optionValues },
        _optionValueSources: { ...this._optionValueSources }
      };
    }
    restoreStateBeforeParse() {
      if (this._storeOptionsAsProperties)
        throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
      this._name = this._savedState._name;
      this._scriptPath = null;
      this.rawArgs = [];
      this._optionValues = { ...this._savedState._optionValues };
      this._optionValueSources = { ...this._savedState._optionValueSources };
      this.args = [];
      this.processedArgs = [];
    }
    _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
      if (fs.existsSync(executableFile))
        return;
      const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
      const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
      throw new Error(executableMissing);
    }
    _executeSubCommand(subcommand, args) {
      args = args.slice();
      let launchWithNode = false;
      const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function findFile(baseDir, baseName) {
        const localBin = path.resolve(baseDir, baseName);
        if (fs.existsSync(localBin))
          return localBin;
        if (sourceExt.includes(path.extname(baseName)))
          return;
        const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
        if (foundExt)
          return `${localBin}${foundExt}`;
        return;
      }
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
      let executableDir = this._executableDir || "";
      if (this._scriptPath) {
        let resolvedScriptPath;
        try {
          resolvedScriptPath = fs.realpathSync(this._scriptPath);
        } catch {
          resolvedScriptPath = this._scriptPath;
        }
        executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
      }
      if (executableDir) {
        let localFile = findFile(executableDir, executableFile);
        if (!localFile && !subcommand._executableFile && this._scriptPath) {
          const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
          if (legacyName !== this._name) {
            localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
          }
        }
        executableFile = localFile || executableFile;
      }
      launchWithNode = sourceExt.includes(path.extname(executableFile));
      let proc;
      if (process2.platform !== "win32") {
        if (launchWithNode) {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
        } else {
          proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
        }
      } else {
        this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process2.execArgv).concat(args);
        proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
      }
      if (!proc.killed) {
        const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
        signals.forEach((signal) => {
          process2.on(signal, () => {
            if (proc.killed === false && proc.exitCode === null) {
              proc.kill(signal);
            }
          });
        });
      }
      const exitCallback = this._exitCallback;
      proc.on("close", (code) => {
        code = code ?? 1;
        if (!exitCallback) {
          process2.exit(code);
        } else {
          exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
        }
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        } else if (err.code === "EACCES") {
          throw new Error(`'${executableFile}' not executable`);
        }
        if (!exitCallback) {
          process2.exit(1);
        } else {
          const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
          wrappedError.nestedError = err;
          exitCallback(wrappedError);
        }
      });
      this.runningCommand = proc;
    }
    _dispatchSubcommand(commandName, operands, unknown) {
      const subCommand = this._findCommand(commandName);
      if (!subCommand)
        this.help({ error: true });
      subCommand._prepareForParse();
      let promiseChain;
      promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
      promiseChain = this._chainOrCall(promiseChain, () => {
        if (subCommand._executableHandler) {
          this._executeSubCommand(subCommand, operands.concat(unknown));
        } else {
          return subCommand._parseCommand(operands, unknown);
        }
      });
      return promiseChain;
    }
    _dispatchHelpCommand(subcommandName) {
      if (!subcommandName) {
        this.help();
      }
      const subCommand = this._findCommand(subcommandName);
      if (subCommand && !subCommand._executableHandler) {
        subCommand.help();
      }
      return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
    }
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((arg, i) => {
        if (arg.required && this.args[i] == null) {
          this.missingArgument(arg.name());
        }
      });
      if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
        return;
      }
      if (this.args.length > this.registeredArguments.length) {
        this._excessArguments(this.args);
      }
    }
    _processArguments() {
      const myParseArg = (argument, value, previous) => {
        let parsedValue = value;
        if (value !== null && argument.parseArg) {
          const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
          parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
        }
        return parsedValue;
      };
      this._checkNumberOfArguments();
      const processedArgs = [];
      this.registeredArguments.forEach((declaredArg, index) => {
        let value = declaredArg.defaultValue;
        if (declaredArg.variadic) {
          if (index < this.args.length) {
            value = this.args.slice(index);
            if (declaredArg.parseArg) {
              value = value.reduce((processed, v) => {
                return myParseArg(declaredArg, v, processed);
              }, declaredArg.defaultValue);
            }
          } else if (value === undefined) {
            value = [];
          }
        } else if (index < this.args.length) {
          value = this.args[index];
          if (declaredArg.parseArg) {
            value = myParseArg(declaredArg, value, declaredArg.defaultValue);
          }
        }
        processedArgs[index] = value;
      });
      this.processedArgs = processedArgs;
    }
    _chainOrCall(promise, fn) {
      if (promise && promise.then && typeof promise.then === "function") {
        return promise.then(() => fn());
      }
      return fn();
    }
    _chainOrCallHooks(promise, event) {
      let result = promise;
      const hooks = [];
      this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== undefined).forEach((hookedCommand) => {
        hookedCommand._lifeCycleHooks[event].forEach((callback) => {
          hooks.push({ hookedCommand, callback });
        });
      });
      if (event === "postAction") {
        hooks.reverse();
      }
      hooks.forEach((hookDetail) => {
        result = this._chainOrCall(result, () => {
          return hookDetail.callback(hookDetail.hookedCommand, this);
        });
      });
      return result;
    }
    _chainOrCallSubCommandHook(promise, subCommand, event) {
      let result = promise;
      if (this._lifeCycleHooks[event] !== undefined) {
        this._lifeCycleHooks[event].forEach((hook) => {
          result = this._chainOrCall(result, () => {
            return hook(this, subCommand);
          });
        });
      }
      return result;
    }
    _parseCommand(operands, unknown) {
      const parsed = this.parseOptions(unknown);
      this._parseOptionsEnv();
      this._parseOptionsImplied();
      operands = operands.concat(parsed.operands);
      unknown = parsed.unknown;
      this.args = operands.concat(unknown);
      if (operands && this._findCommand(operands[0])) {
        return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
      }
      if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
        return this._dispatchHelpCommand(operands[1]);
      }
      if (this._defaultCommandName) {
        this._outputHelpIfRequested(unknown);
        return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
      }
      if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
        this.help({ error: true });
      }
      this._outputHelpIfRequested(parsed.unknown);
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      const checkForUnknownOptions = () => {
        if (parsed.unknown.length > 0) {
          this.unknownOption(parsed.unknown[0]);
        }
      };
      const commandEvent = `command:${this.name()}`;
      if (this._actionHandler) {
        checkForUnknownOptions();
        this._processArguments();
        let promiseChain;
        promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
        promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
        if (this.parent) {
          promiseChain = this._chainOrCall(promiseChain, () => {
            this.parent.emit(commandEvent, operands, unknown);
          });
        }
        promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
        return promiseChain;
      }
      if (this.parent && this.parent.listenerCount(commandEvent)) {
        checkForUnknownOptions();
        this._processArguments();
        this.parent.emit(commandEvent, operands, unknown);
      } else if (operands.length) {
        if (this._findCommand("*")) {
          return this._dispatchSubcommand("*", operands, unknown);
        }
        if (this.listenerCount("command:*")) {
          this.emit("command:*", operands, unknown);
        } else if (this.commands.length) {
          this.unknownCommand();
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      } else if (this.commands.length) {
        checkForUnknownOptions();
        this.help({ error: true });
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    }
    _findCommand(name) {
      if (!name)
        return;
      return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
    }
    _findOption(arg) {
      return this.options.find((option) => option.is(arg));
    }
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd.options.forEach((anOption) => {
          if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
            cmd.missingMandatoryOptionValue(anOption);
          }
        });
      });
    }
    _checkForConflictingLocalOptions() {
      const definedNonDefaultOptions = this.options.filter((option) => {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined) {
          return false;
        }
        return this.getOptionValueSource(optionKey) !== "default";
      });
      const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
      optionsWithConflicting.forEach((option) => {
        const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
        if (conflictingAndDefined) {
          this._conflictingOption(option, conflictingAndDefined);
        }
      });
    }
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd._checkForConflictingLocalOptions();
      });
    }
    parseOptions(argv) {
      const operands = [];
      const unknown = [];
      let dest = operands;
      const args = argv.slice();
      function maybeOption(arg) {
        return arg.length > 1 && arg[0] === "-";
      }
      let activeVariadicOption = null;
      while (args.length) {
        const arg = args.shift();
        if (arg === "--") {
          if (dest === unknown)
            dest.push(arg);
          dest.push(...args);
          break;
        }
        if (activeVariadicOption && !maybeOption(arg)) {
          this.emit(`option:${activeVariadicOption.name()}`, arg);
          continue;
        }
        activeVariadicOption = null;
        if (maybeOption(arg)) {
          const option = this._findOption(arg);
          if (option) {
            if (option.required) {
              const value = args.shift();
              if (value === undefined)
                this.optionMissingArgument(option);
              this.emit(`option:${option.name()}`, value);
            } else if (option.optional) {
              let value = null;
              if (args.length > 0 && !maybeOption(args[0])) {
                value = args.shift();
              }
              this.emit(`option:${option.name()}`, value);
            } else {
              this.emit(`option:${option.name()}`);
            }
            activeVariadicOption = option.variadic ? option : null;
            continue;
          }
        }
        if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
          const option = this._findOption(`-${arg[1]}`);
          if (option) {
            if (option.required || option.optional && this._combineFlagAndOptionalValue) {
              this.emit(`option:${option.name()}`, arg.slice(2));
            } else {
              this.emit(`option:${option.name()}`);
              args.unshift(`-${arg.slice(2)}`);
            }
            continue;
          }
        }
        if (/^--[^=]+=/.test(arg)) {
          const index = arg.indexOf("=");
          const option = this._findOption(arg.slice(0, index));
          if (option && (option.required || option.optional)) {
            this.emit(`option:${option.name()}`, arg.slice(index + 1));
            continue;
          }
        }
        if (maybeOption(arg)) {
          dest = unknown;
        }
        if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
          if (this._findCommand(arg)) {
            operands.push(arg);
            if (args.length > 0)
              unknown.push(...args);
            break;
          } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
            operands.push(arg);
            if (args.length > 0)
              operands.push(...args);
            break;
          } else if (this._defaultCommandName) {
            unknown.push(arg);
            if (args.length > 0)
              unknown.push(...args);
            break;
          }
        }
        if (this._passThroughOptions) {
          dest.push(arg);
          if (args.length > 0)
            dest.push(...args);
          break;
        }
        dest.push(arg);
      }
      return { operands, unknown };
    }
    opts() {
      if (this._storeOptionsAsProperties) {
        const result = {};
        const len = this.options.length;
        for (let i = 0;i < len; i++) {
          const key = this.options[i].attributeName();
          result[key] = key === this._versionOptionName ? this._version : this[key];
        }
        return result;
      }
      return this._optionValues;
    }
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
    }
    error(message, errorOptions) {
      this._outputConfiguration.outputError(`${message}
`, this._outputConfiguration.writeErr);
      if (typeof this._showHelpAfterError === "string") {
        this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
      } else if (this._showHelpAfterError) {
        this._outputConfiguration.writeErr(`
`);
        this.outputHelp({ error: true });
      }
      const config = errorOptions || {};
      const exitCode = config.exitCode || 1;
      const code = config.code || "commander.error";
      this._exit(exitCode, code, message);
    }
    _parseOptionsEnv() {
      this.options.forEach((option) => {
        if (option.envVar && option.envVar in process2.env) {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === undefined || ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))) {
            if (option.required || option.optional) {
              this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
            } else {
              this.emit(`optionEnv:${option.name()}`);
            }
          }
        }
      });
    }
    _parseOptionsImplied() {
      const dualHelper = new DualOptions(this.options);
      const hasCustomOptionValue = (optionKey) => {
        return this.getOptionValue(optionKey) !== undefined && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
      };
      this.options.filter((option) => option.implied !== undefined && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
        Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
          this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
        });
      });
    }
    missingArgument(name) {
      const message = `error: missing required argument '${name}'`;
      this.error(message, { code: "commander.missingArgument" });
    }
    optionMissingArgument(option) {
      const message = `error: option '${option.flags}' argument missing`;
      this.error(message, { code: "commander.optionMissingArgument" });
    }
    missingMandatoryOptionValue(option) {
      const message = `error: required option '${option.flags}' not specified`;
      this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }
    _conflictingOption(option, conflictingOption) {
      const findBestOptionFromValue = (option2) => {
        const optionKey = option2.attributeName();
        const optionValue = this.getOptionValue(optionKey);
        const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
        const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
        if (negativeOption && (negativeOption.presetArg === undefined && optionValue === false || negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg)) {
          return negativeOption;
        }
        return positiveOption || option2;
      };
      const getErrorMessage = (option2) => {
        const bestOption = findBestOptionFromValue(option2);
        const optionKey = bestOption.attributeName();
        const source = this.getOptionValueSource(optionKey);
        if (source === "env") {
          return `environment variable '${bestOption.envVar}'`;
        }
        return `option '${bestOption.flags}'`;
      };
      const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
      this.error(message, { code: "commander.conflictingOption" });
    }
    unknownOption(flag) {
      if (this._allowUnknownOption)
        return;
      let suggestion = "";
      if (flag.startsWith("--") && this._showSuggestionAfterError) {
        let candidateFlags = [];
        let command = this;
        do {
          const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
          candidateFlags = candidateFlags.concat(moreFlags);
          command = command.parent;
        } while (command && !command._enablePositionalOptions);
        suggestion = suggestSimilar(flag, candidateFlags);
      }
      const message = `error: unknown option '${flag}'${suggestion}`;
      this.error(message, { code: "commander.unknownOption" });
    }
    _excessArguments(receivedArgs) {
      if (this._allowExcessArguments)
        return;
      const expected = this.registeredArguments.length;
      const s = expected === 1 ? "" : "s";
      const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
      const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
      this.error(message, { code: "commander.excessArguments" });
    }
    unknownCommand() {
      const unknownName = this.args[0];
      let suggestion = "";
      if (this._showSuggestionAfterError) {
        const candidateNames = [];
        this.createHelp().visibleCommands(this).forEach((command) => {
          candidateNames.push(command.name());
          if (command.alias())
            candidateNames.push(command.alias());
        });
        suggestion = suggestSimilar(unknownName, candidateNames);
      }
      const message = `error: unknown command '${unknownName}'${suggestion}`;
      this.error(message, { code: "commander.unknownCommand" });
    }
    version(str, flags, description) {
      if (str === undefined)
        return this._version;
      this._version = str;
      flags = flags || "-V, --version";
      description = description || "output the version number";
      const versionOption = this.createOption(flags, description);
      this._versionOptionName = versionOption.attributeName();
      this._registerOption(versionOption);
      this.on("option:" + versionOption.name(), () => {
        this._outputConfiguration.writeOut(`${str}
`);
        this._exit(0, "commander.version", str);
      });
      return this;
    }
    description(str, argsDescription) {
      if (str === undefined && argsDescription === undefined)
        return this._description;
      this._description = str;
      if (argsDescription) {
        this._argsDescription = argsDescription;
      }
      return this;
    }
    summary(str) {
      if (str === undefined)
        return this._summary;
      this._summary = str;
      return this;
    }
    alias(alias) {
      if (alias === undefined)
        return this._aliases[0];
      let command = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
        command = this.commands[this.commands.length - 1];
      }
      if (alias === command._name)
        throw new Error("Command alias can't be the same as its name");
      const matchingCommand = this.parent?._findCommand(alias);
      if (matchingCommand) {
        const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
        throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
      }
      command._aliases.push(alias);
      return this;
    }
    aliases(aliases) {
      if (aliases === undefined)
        return this._aliases;
      aliases.forEach((alias) => this.alias(alias));
      return this;
    }
    usage(str) {
      if (str === undefined) {
        if (this._usage)
          return this._usage;
        const args = this.registeredArguments.map((arg) => {
          return humanReadableArgName(arg);
        });
        return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
      }
      this._usage = str;
      return this;
    }
    name(str) {
      if (str === undefined)
        return this._name;
      this._name = str;
      return this;
    }
    nameFromFilename(filename) {
      this._name = path.basename(filename, path.extname(filename));
      return this;
    }
    executableDir(path2) {
      if (path2 === undefined)
        return this._executableDir;
      this._executableDir = path2;
      return this;
    }
    helpInformation(contextOptions) {
      const helper = this.createHelp();
      const context = this._getOutputContext(contextOptions);
      helper.prepareContext({
        error: context.error,
        helpWidth: context.helpWidth,
        outputHasColors: context.hasColors
      });
      const text = helper.formatHelp(this, helper);
      if (context.hasColors)
        return text;
      return this._outputConfiguration.stripColor(text);
    }
    _getOutputContext(contextOptions) {
      contextOptions = contextOptions || {};
      const error = !!contextOptions.error;
      let baseWrite;
      let hasColors;
      let helpWidth;
      if (error) {
        baseWrite = (str) => this._outputConfiguration.writeErr(str);
        hasColors = this._outputConfiguration.getErrHasColors();
        helpWidth = this._outputConfiguration.getErrHelpWidth();
      } else {
        baseWrite = (str) => this._outputConfiguration.writeOut(str);
        hasColors = this._outputConfiguration.getOutHasColors();
        helpWidth = this._outputConfiguration.getOutHelpWidth();
      }
      const write = (str) => {
        if (!hasColors)
          str = this._outputConfiguration.stripColor(str);
        return baseWrite(str);
      };
      return { error, write, hasColors, helpWidth };
    }
    outputHelp(contextOptions) {
      let deprecatedCallback;
      if (typeof contextOptions === "function") {
        deprecatedCallback = contextOptions;
        contextOptions = undefined;
      }
      const outputContext = this._getOutputContext(contextOptions);
      const eventContext = {
        error: outputContext.error,
        write: outputContext.write,
        command: this
      };
      this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
      this.emit("beforeHelp", eventContext);
      let helpInformation = this.helpInformation({ error: outputContext.error });
      if (deprecatedCallback) {
        helpInformation = deprecatedCallback(helpInformation);
        if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
          throw new Error("outputHelp callback must return a string or a Buffer");
        }
      }
      outputContext.write(helpInformation);
      if (this._getHelpOption()?.long) {
        this.emit(this._getHelpOption().long);
      }
      this.emit("afterHelp", eventContext);
      this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
    }
    helpOption(flags, description) {
      if (typeof flags === "boolean") {
        if (flags) {
          this._helpOption = this._helpOption ?? undefined;
        } else {
          this._helpOption = null;
        }
        return this;
      }
      flags = flags ?? "-h, --help";
      description = description ?? "display help for command";
      this._helpOption = this.createOption(flags, description);
      return this;
    }
    _getHelpOption() {
      if (this._helpOption === undefined) {
        this.helpOption(undefined, undefined);
      }
      return this._helpOption;
    }
    addHelpOption(option) {
      this._helpOption = option;
      return this;
    }
    help(contextOptions) {
      this.outputHelp(contextOptions);
      let exitCode = Number(process2.exitCode ?? 0);
      if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
        exitCode = 1;
      }
      this._exit(exitCode, "commander.help", "(outputHelp)");
    }
    addHelpText(position, text) {
      const allowedValues = ["beforeAll", "before", "after", "afterAll"];
      if (!allowedValues.includes(position)) {
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      const helpEvent = `${position}Help`;
      this.on(helpEvent, (context) => {
        let helpStr;
        if (typeof text === "function") {
          helpStr = text({ error: context.error, command: context.command });
        } else {
          helpStr = text;
        }
        if (helpStr) {
          context.write(`${helpStr}
`);
        }
      });
      return this;
    }
    _outputHelpIfRequested(args) {
      const helpOption = this._getHelpOption();
      const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
      if (helpRequested) {
        this.outputHelp();
        this._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      if (!arg.startsWith("--inspect")) {
        return arg;
      }
      let debugOption;
      let debugHost = "127.0.0.1";
      let debugPort = "9229";
      let match;
      if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
        debugOption = match[1];
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
        debugOption = match[1];
        if (/^\d+$/.test(match[3])) {
          debugPort = match[3];
        } else {
          debugHost = match[3];
        }
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
        debugOption = match[1];
        debugHost = match[3];
        debugPort = match[4];
      }
      if (debugOption && debugPort !== "0") {
        return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
      }
      return arg;
    });
  }
  function useColor() {
    if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
      return false;
    if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== undefined)
      return true;
    return;
  }
  exports.Command = Command;
  exports.useColor = useColor;
});

// node_modules/commander/index.js
var require_commander = __commonJS((exports) => {
  var { Argument } = require_argument();
  var { Command } = require_command();
  var { CommanderError, InvalidArgumentError } = require_error();
  var { Help } = require_help();
  var { Option } = require_option();
  exports.program = new Command;
  exports.createCommand = (name) => new Command(name);
  exports.createOption = (flags, description) => new Option(flags, description);
  exports.createArgument = (name, description) => new Argument(name, description);
  exports.Command = Command;
  exports.Option = Option;
  exports.Argument = Argument;
  exports.Help = Help;
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
  exports.InvalidOptionArgumentError = InvalidArgumentError;
});

// node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS((exports, module) => {
  var p = process || {};
  var argv = p.argv || [];
  var env = p.env || {};
  var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
  var formatter = (open, close, replace = open) => (input) => {
    let string = "" + input, index = string.indexOf(close, open.length);
    return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
  };
  var replaceClose = (string, close, replace, index) => {
    let result = "", cursor = 0;
    do {
      result += string.substring(cursor, index) + replace;
      cursor = index + close.length;
      index = string.indexOf(close, cursor);
    } while (~index);
    return result + string.substring(cursor);
  };
  var createColors = (enabled = isColorSupported) => {
    let f = enabled ? formatter : () => String;
    return {
      isColorSupported: enabled,
      reset: f("\x1B[0m", "\x1B[0m"),
      bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: f("\x1B[3m", "\x1B[23m"),
      underline: f("\x1B[4m", "\x1B[24m"),
      inverse: f("\x1B[7m", "\x1B[27m"),
      hidden: f("\x1B[8m", "\x1B[28m"),
      strikethrough: f("\x1B[9m", "\x1B[29m"),
      black: f("\x1B[30m", "\x1B[39m"),
      red: f("\x1B[31m", "\x1B[39m"),
      green: f("\x1B[32m", "\x1B[39m"),
      yellow: f("\x1B[33m", "\x1B[39m"),
      blue: f("\x1B[34m", "\x1B[39m"),
      magenta: f("\x1B[35m", "\x1B[39m"),
      cyan: f("\x1B[36m", "\x1B[39m"),
      white: f("\x1B[37m", "\x1B[39m"),
      gray: f("\x1B[90m", "\x1B[39m"),
      bgBlack: f("\x1B[40m", "\x1B[49m"),
      bgRed: f("\x1B[41m", "\x1B[49m"),
      bgGreen: f("\x1B[42m", "\x1B[49m"),
      bgYellow: f("\x1B[43m", "\x1B[49m"),
      bgBlue: f("\x1B[44m", "\x1B[49m"),
      bgMagenta: f("\x1B[45m", "\x1B[49m"),
      bgCyan: f("\x1B[46m", "\x1B[49m"),
      bgWhite: f("\x1B[47m", "\x1B[49m"),
      blackBright: f("\x1B[90m", "\x1B[39m"),
      redBright: f("\x1B[91m", "\x1B[39m"),
      greenBright: f("\x1B[92m", "\x1B[39m"),
      yellowBright: f("\x1B[93m", "\x1B[39m"),
      blueBright: f("\x1B[94m", "\x1B[39m"),
      magentaBright: f("\x1B[95m", "\x1B[39m"),
      cyanBright: f("\x1B[96m", "\x1B[39m"),
      whiteBright: f("\x1B[97m", "\x1B[39m"),
      bgBlackBright: f("\x1B[100m", "\x1B[49m"),
      bgRedBright: f("\x1B[101m", "\x1B[49m"),
      bgGreenBright: f("\x1B[102m", "\x1B[49m"),
      bgYellowBright: f("\x1B[103m", "\x1B[49m"),
      bgBlueBright: f("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
      bgCyanBright: f("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: f("\x1B[107m", "\x1B[49m")
    };
  };
  module.exports = createColors();
  module.exports.createColors = createColors;
});

// node_modules/nanospinner/dist/consts.js
var require_consts = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.symbols = exports.isTTY = undefined;
  var node_tty_1 = __importDefault(__require("tty"));
  var node_process_1 = __importDefault(__require("process"));
  var isCI = node_process_1.default.env.CI || node_process_1.default.env.WT_SESSION || node_process_1.default.env.ConEmuTask === "{cmd::Cmder}" || node_process_1.default.env.TERM_PROGRAM === "vscode" || node_process_1.default.env.TERM === "xterm-256color" || node_process_1.default.env.TERM === "alacritty";
  var isTTY = node_tty_1.default.isatty(1) && node_process_1.default.env.TERM !== "dumb" && !("CI" in node_process_1.default.env);
  exports.isTTY = isTTY;
  var supportUnicode = node_process_1.default.platform !== "win32" ? node_process_1.default.env.TERM !== "linux" : isCI;
  var symbols = {
    frames: isTTY ? supportUnicode ? ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"] : ["-", "\\", "|", "/"] : ["-"],
    tick: supportUnicode ? "\u2714" : "\u221A",
    cross: supportUnicode ? "\u2716" : "\xD7",
    warn: supportUnicode ? "\u26A0" : "!!",
    info: supportUnicode ? "\u2139" : "i"
  };
  exports.symbols = symbols;
});

// node_modules/nanospinner/dist/index.js
var require_dist = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createSpinner = createSpinner;
  var picocolors_1 = __importDefault(require_picocolors());
  var consts_1 = require_consts();
  function getLines(str = "", width = 80) {
    return str.replace(/\u001b[^m]*?m/g, "").split(`
`).reduce((col, line) => col += Math.max(1, Math.ceil(line.length / width)), 0);
  }
  function createSpinner(text = "", opts = {}) {
    let current = 0, interval = opts.interval || 50, stream = opts.stream || process.stderr, frames = opts.frames && opts.frames.length ? opts.frames : consts_1.symbols.frames, color = opts.color || "yellow", spinning = false, lines = 0, timer = undefined, getText = (opts2 = {}) => typeof opts2 === "string" ? opts2 : opts2.text || text, getUpdate = (opts2 = {}) => typeof opts2 === "string" ? false : !!opts2.update, getColor = (opts2 = {}) => typeof opts2 === "string" || !opts2.color ? color : opts2.color, getMark = (opts2 = {}, fallback) => typeof opts2 === "string" || !opts2.mark ? fallback : opts2.mark, mountProcessEvents = () => {
      process.on("SIGINT", exit);
      process.on("SIGTERM", exit);
    }, cleanupProcessEvents = () => {
      process.off("SIGINT", exit);
      process.off("SIGTERM", exit);
    };
    let spinner = {
      reset() {
        current = 0;
        lines = 0;
        spinning = false;
        clearTimeout(timer);
        timer = undefined;
        return spinner;
      },
      clear() {
        spinner.write("\x1B[1G");
        for (let i = 0;i < lines; i++) {
          i > 0 && spinner.write("\x1B[1A");
          spinner.write("\x1B[2K\x1B[1G");
        }
        lines = 0;
        return spinner;
      },
      write(str, clear = false) {
        if (clear && consts_1.isTTY)
          spinner.clear();
        stream.write(str);
        return spinner;
      },
      render() {
        let str = `${picocolors_1.default[color](frames[current])} ${text}`;
        consts_1.isTTY ? spinner.write(`\x1B[?25l`) : str += `
`;
        spinner.write(str, true);
        consts_1.isTTY && (lines = getLines(str, stream.columns));
        return spinner;
      },
      spin() {
        spinner.render();
        current = ++current % frames.length;
        return spinner;
      },
      update(opts2) {
        if (typeof opts2 === "string") {
          text = opts2;
        } else {
          text = opts2.text || text;
          frames = opts2.frames && opts2.frames.length ? opts2.frames : frames;
          interval = opts2.interval || interval;
          color = opts2.color || color;
        }
        if (frames.length - 1 < current)
          current = 0;
        return spinner;
      },
      loop() {
        consts_1.isTTY && (timer = setTimeout(() => spinner.loop(), interval));
        return spinner.spin();
      },
      start(opts2 = {}) {
        timer && spinner.reset();
        spinning = true;
        mountProcessEvents();
        return spinner.update({ text: getText(opts2), color: getColor(opts2) }).loop();
      },
      stop(opts2) {
        spinning = false;
        clearTimeout(timer);
        timer = undefined;
        cleanupProcessEvents();
        const update = getUpdate(opts2);
        const mark = picocolors_1.default[getColor(opts2)](getMark(opts2, frames[current]));
        const text2 = getText(opts2);
        spinner.write(opts2 ? `${mark} ${text2}${update ? "" : `
`}` : "", true);
        return consts_1.isTTY && !update ? spinner.write(`\x1B[?25h`) : spinner;
      },
      success(opts2 = {}) {
        return spinner.stop({
          text: getText(opts2),
          mark: getMark(opts2, consts_1.symbols.tick),
          color: "green",
          update: getUpdate(opts2)
        });
      },
      error(opts2 = {}) {
        return spinner.stop({
          text: getText(opts2),
          mark: getMark(opts2, consts_1.symbols.cross),
          color: "red",
          update: getUpdate(opts2)
        });
      },
      warn(opts2 = {}) {
        return spinner.stop({
          text: getText(opts2),
          mark: getMark(opts2, consts_1.symbols.warn),
          color: "yellow",
          update: getUpdate(opts2)
        });
      },
      info(opts2 = {}) {
        return spinner.stop({
          text: getText(opts2),
          mark: getMark(opts2, consts_1.symbols.info),
          color: "blue",
          update: getUpdate(opts2)
        });
      },
      isSpinning() {
        return spinning;
      }
    };
    function exit(signal) {
      if (spinning) {
        spinner.stop();
      }
      process.exit(signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
    }
    return spinner;
  }
});

// node_modules/commander/esm.mjs
var import__ = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  Command,
  Argument,
  Option,
  Help
} = import__.default;

// src/commands/nav.ts
import { writeFileSync } from "fs";

// src/domain/workspace.ts
import { readdir, stat } from "fs/promises";
import { accessSync } from "fs";
import { join, basename as basename2, dirname } from "path";

// src/domain/package.ts
import { basename } from "path";

// src/domain/git.ts
var {$ } = globalThis.Bun;
async function status(cwd) {
  const [statusOut, branch] = await Promise.all([
    $`git -C ${cwd} status --porcelain`.text().catch(() => ""),
    currentBranch(cwd)
  ]);
  const files = statusOut.trim().split(`
`).filter((l) => l.length > 0);
  return {
    dirty: files.length > 0,
    files,
    branch
  };
}
async function currentBranch(cwd) {
  return (await $`git -C ${cwd} branch --show-current`.text()).trim();
}
async function branches(cwd) {
  const raw = await $`git -C ${cwd} for-each-ref --format=${"%(HEAD)|%(refname:short)|%(upstream:short)|%(upstream:trackshort)"} refs/heads`.text().catch(() => "");
  return raw.trim().split(`
`).filter((l) => l.length > 0).map((line) => {
    const [head, name, upstream, trackShort] = line.split("|");
    return {
      name: name.trim(),
      isCurrent: head.trim() === "*",
      upstream: upstream?.trim() || undefined,
      trackingStatus: trackShort?.trim() || undefined
    };
  });
}
async function fetch(cwd, remote = "origin", branch = "mainline") {
  await $`git -C ${cwd} fetch -q ${remote} ${branch}`.quiet();
}
async function rebase(cwd, upstream = "origin/mainline") {
  try {
    await $`git -C ${cwd} rebase -q ${upstream}`.quiet();
    return { success: true, conflict: false };
  } catch {
    try {
      await $`git -C ${cwd} rebase --abort`.quiet();
    } catch {}
    return { success: false, conflict: true };
  }
}
async function diff(cwd, base) {
  if (base) {
    return $`git -C ${cwd} diff ${base}`.text().catch(() => "");
  }
  return $`git -C ${cwd} diff`.text().catch(() => "");
}
async function diffStat(cwd, base) {
  if (base) {
    return $`git -C ${cwd} diff --stat ${base}`.text().catch(() => "");
  }
  return $`git -C ${cwd} diff --stat`.text().catch(() => "");
}
async function log(cwd, range, format) {
  const fmt = format ?? "--oneline";
  if (range) {
    return $`git -C ${cwd} log ${fmt} ${range}`.text().catch(() => "");
  }
  return $`git -C ${cwd} log ${fmt}`.text().catch(() => "");
}
async function aheadBehind(cwd, upstream = "origin/mainline") {
  const [ahead, behind] = await Promise.all([
    $`git -C ${cwd} rev-list --count ${upstream}..HEAD`.text().catch(() => "0"),
    $`git -C ${cwd} rev-list --count HEAD..${upstream}`.text().catch(() => "0")
  ]);
  return {
    ahead: parseInt(ahead.trim(), 10) || 0,
    behind: parseInt(behind.trim(), 10) || 0
  };
}
async function isClean(cwd) {
  const out = await $`git -C ${cwd} status --porcelain`.text().catch(() => "");
  return out.trim().length === 0;
}
async function commitAll(cwd, message) {
  await $`git -C ${cwd} add -A`.quiet();
  if (await isClean(cwd))
    return false;
  await $`git -C ${cwd} commit -q -m ${message}`.quiet();
  return true;
}
async function amendMessage(cwd, message) {
  await $`git -C ${cwd} commit -q --amend -m ${message}`.quiet();
}
async function createBranch(cwd, name) {
  await $`git -C ${cwd} branch ${name}`.quiet();
}
async function resetSoft(cwd, ref) {
  await $`git -C ${cwd} reset --soft ${ref}`.quiet();
}

// src/domain/package.ts
class Package {
  path;
  workspace;
  constructor(path, workspace) {
    this.path = path;
    this.workspace = workspace;
  }
  get name() {
    return basename(this.path);
  }
  async status() {
    return status(this.path);
  }
  async currentBranch() {
    return currentBranch(this.path);
  }
  async branches() {
    return branches(this.path);
  }
  async fetch(remote = "origin", branch = "mainline") {
    return fetch(this.path, remote, branch);
  }
  async rebase(upstream = "origin/mainline") {
    return rebase(this.path, upstream);
  }
  async diff(base = "origin/mainline") {
    return diff(this.path, base);
  }
  async diffStat(base) {
    return diffStat(this.path, base);
  }
  async log(range, format) {
    return log(this.path, range, format);
  }
  async aheadBehind(upstream = "origin/mainline") {
    return aheadBehind(this.path, upstream);
  }
}

// src/domain/workspace.ts
class Workspace {
  root;
  constructor(root) {
    this.root = root;
  }
  get name() {
    return basename2(this.root);
  }
  get srcDir() {
    return join(this.root, "src");
  }
  async packages() {
    const entries = await readdir(this.srcDir, { withFileTypes: true });
    const packages = [];
    for (const entry of entries) {
      if (!entry.isDirectory())
        continue;
      const pkgPath = join(this.srcDir, entry.name);
      const gitDir = join(pkgPath, ".git");
      try {
        const s = await stat(gitDir);
        if (s.isDirectory()) {
          packages.push(new Package(pkgPath, this));
        }
      } catch {}
    }
    return packages.sort((a, b) => a.name.localeCompare(b.name));
  }
  async allDirs() {
    const entries = await readdir(this.srcDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  }
  async allSrcPackages() {
    const entries = await readdir(this.srcDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => new Package(join(this.srcDir, e.name), this)).sort((a, b) => a.name.localeCompare(b.name));
  }
  async findPackage(query) {
    const all = await this.packages();
    const lower = query.toLowerCase();
    const exact = all.filter((p) => p.name.toLowerCase() === lower);
    if (exact.length > 0)
      return exact;
    return all.filter((p) => p.name.toLowerCase().includes(lower));
  }
  currentPackage() {
    const cwd = process.cwd();
    const prefix = this.srcDir + "/";
    if (!cwd.startsWith(prefix))
      return null;
    const relative = cwd.slice(prefix.length);
    const pkgName = relative.split("/")[0];
    if (!pkgName)
      return null;
    return new Package(join(this.srcDir, pkgName), this);
  }
  async findCdkPackage() {
    const all = await this.packages();
    return all.find((p) => p.name.toLowerCase().includes("cdk"));
  }
  async findIntegTestPackages() {
    const all = await this.packages();
    return all.filter((p) => p.name.toLowerCase().includes("integrationtests"));
  }
  static discover(from) {
    let dir = from ?? process.cwd();
    while (dir !== "/") {
      const candidate = join(dir, "packageInfo");
      if (fileExistsSync(candidate)) {
        return new Workspace(dir);
      }
      dir = dirname(dir);
    }
    return null;
  }
}
function fileExistsSync(path) {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
}

// src/lib/ui.ts
var import_picocolors = __toESM(require_picocolors(), 1);
var c = {
  pkg: (s) => import_picocolors.default.cyan(s),
  branch: (s) => import_picocolors.default.magenta(s),
  ok: (s) => import_picocolors.default.green(s),
  warn: (s) => import_picocolors.default.yellow(s),
  err: (s) => import_picocolors.default.red(s),
  dim: (s) => import_picocolors.default.dim(s),
  bold: (s) => import_picocolors.default.bold(s),
  header: (s) => import_picocolors.default.bold(import_picocolors.default.blue(s))
};
function header(text) {
  console.log(c.header(text));
}
function table(rows, options) {
  if (rows.length === 0)
    return;
  const indent = " ".repeat(options?.indent ?? 2);
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths = Array(colCount).fill(0);
  for (const row of rows) {
    for (let i = 0;i < row.length; i++) {
      const stripped = stripAnsi(row[i]);
      widths[i] = Math.max(widths[i], stripped.length);
    }
  }
  for (const row of rows) {
    const cells = row.map((cell, i) => {
      if (i === row.length - 1)
        return cell;
      const stripped = stripAnsi(cell);
      const padding = widths[i] - stripped.length;
      return cell + " ".repeat(Math.max(0, padding));
    });
    console.log(indent + cells.join("  "));
  }
}
function nav(text) {
  console.log(`${c.dim("->")} ${text}`);
}
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, "");
}
function empty(text) {
  console.log(c.dim(text));
}
function separator(width = 50) {
  console.log(c.dim("\u2500".repeat(width)));
}
function prompt(message) {
  return new Promise((resolve) => {
    const { createInterface } = __require("readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
async function confirm(message, defaultYes = true) {
  const suffix = defaultYes ? c.dim("[Y/n]") : c.dim("[y/N]");
  const answer = await prompt(`${message} ${suffix} `);
  const lower = answer.toLowerCase();
  if (defaultYes)
    return lower !== "n" && lower !== "no";
  return lower === "y" || lower === "yes";
}
function confirmWithTimeout(message, timeoutSec = 10, defaultYes = true) {
  return new Promise((resolve) => {
    const { createInterface } = __require("readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let remaining = timeoutSec;
    const suffix = defaultYes ? "Y/n" : "y/N";
    const autoAction = defaultYes ? "yes" : "no";
    function writePrompt() {
      process.stdout.write(`\r${message} ${c.dim(`[${suffix}]`)} ${c.dim(`(auto-${autoAction} in ${remaining}s)`)} `);
    }
    writePrompt();
    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        rl.close();
        process.stdout.write(`\r${message} ${c.dim(`[${suffix}]`)} ${c.dim(`auto-${autoAction}`)}
`);
        resolve(defaultYes);
      } else {
        writePrompt();
      }
    }, 1000);
    rl.question("", (answer) => {
      clearInterval(timer);
      rl.close();
      const lower = answer.trim().toLowerCase();
      if (defaultYes) {
        resolve(lower !== "n" && lower !== "no");
      } else {
        resolve(lower === "y" || lower === "yes");
      }
    });
  });
}
async function fzfSelect(items, opts) {
  const height = opts?.height ?? 10;
  const proc = Bun.spawn(["fzf", `--height=${height}`, "--layout=reverse"], {
    stdin: new Blob([items.join(`
`)]),
    stdout: "pipe",
    stderr: "inherit"
  });
  const output = await new Response(proc.stdout).text();
  const selected = output.trim();
  if (!selected) {
    process.exit(1);
  }
  return selected;
}
function formatDuration(ms) {
  if (ms < 1000)
    return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60)
    return `${s}s`;
  const m = Math.floor(s / 60);
  const remaining = s % 60;
  return remaining > 0 ? `${m}m ${remaining}s` : `${m}m`;
}
function formatRelativeTime(timestamp) {
  const diff2 = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff2 / 60000);
  if (minutes < 1)
    return "just now";
  if (minutes < 60)
    return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1)
    return "yesterday";
  return `${days}d ago`;
}

// src/commands/nav.ts
var NAV_FILE = "/tmp/zh-nav";
function registerNavCommand(program2) {
  program2.command("nav").argument("<query>", "Package name (fuzzy match)").description("Navigate to a package directory").action(async (query) => {
    await navigate(query);
  });
  program2.argument("[query]", "Package name to navigate to").action(async (query) => {
    if (query) {
      await navigate(query);
    }
  });
}
async function navigate(query) {
  const ws = Workspace.discover();
  if (!ws) {
    console.error(c.err("No workspace found (no packageInfo in parent dirs)"));
    process.exit(1);
  }
  const matches = await ws.findPackage(query);
  let targetPath;
  if (matches.length === 0) {
    const allDirs = await ws.allDirs();
    const dirMatches = allDirs.filter((d) => d.toLowerCase().includes(query.toLowerCase()));
    if (dirMatches.length === 0) {
      console.error(c.err(`No match for '${query}'`));
      process.exit(1);
    } else if (dirMatches.length === 1) {
      targetPath = `${ws.srcDir}/${dirMatches[0]}`;
    } else {
      targetPath = await fzfSelect2(dirMatches.map((d) => `${ws.srcDir}/${d}`));
    }
  } else if (matches.length === 1) {
    targetPath = matches[0].path;
  } else {
    targetPath = await fzfSelect2(matches.map((m) => m.path));
  }
  writeFileSync(NAV_FILE, targetPath);
  nav(c.pkg(targetPath.split("/").pop()));
}
async function fzfSelect2(paths) {
  const labels = paths.map((p) => p.split("/").pop());
  const proc = Bun.spawn(["fzf", "--height=10", "--layout=reverse"], {
    stdin: new Blob([labels.join(`
`)]),
    stdout: "pipe",
    stderr: "inherit"
  });
  const output = await new Response(proc.stdout).text();
  const selected = output.trim();
  if (!selected) {
    process.exit(1);
  }
  const idx = labels.indexOf(selected);
  return paths[idx];
}

// src/lib/runner.ts
async function parallel(packages, fn, options) {
  const concurrency = options?.concurrency ?? 8;
  const results = Array(packages.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < packages.length) {
      const idx = nextIndex++;
      const pkg = packages[idx];
      try {
        const result = await fn(pkg);
        results[idx] = { pkg, result };
      } catch (err) {
        results[idx] = { pkg, error: err };
      }
    }
  }
  const workers = Array(Math.min(concurrency, packages.length)).fill(null).map(() => worker());
  await Promise.all(workers);
  return results;
}

// src/commands/status.ts
function registerStatusCommand(program2) {
  program2.command("status").alias("st").description("Show status across all repos (branches, changes, ahead/behind)").option("-d, --diff", "Include diff stats for dirty repos").option("-a, --all", "Show all repos, not just interesting ones").action(async (options) => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found"));
      process.exit(1);
    }
    const packages = await ws.packages();
    if (packages.length === 0) {
      empty("No packages found");
      return;
    }
    const results = await parallel(packages, async (pkg) => {
      const [status2, ab] = await Promise.all([pkg.status(), pkg.aheadBehind()]);
      return {
        branch: status2.branch,
        ahead: ab.ahead,
        behind: ab.behind,
        dirty: status2.dirty,
        fileCount: status2.files.length
      };
    });
    const rows = results.filter((r) => {
      if (r.error)
        return true;
      if (options.all)
        return true;
      const s = r.result;
      return s.dirty || s.ahead > 0 || s.behind > 0 || s.branch !== "mainline";
    });
    if (rows.length === 0) {
      empty(`All ${packages.length} repos clean on mainline`);
      return;
    }
    const tableRows = [];
    for (const r of rows) {
      if (r.error) {
        tableRows.push([c.pkg(r.pkg.name), c.err("error"), "", ""]);
        continue;
      }
      const s = r.result;
      const branchStr = s.branch === "mainline" ? c.dim("mainline") : c.branch(s.branch);
      const parts = [];
      if (s.ahead > 0)
        parts.push(c.ok(`+${s.ahead}`));
      if (s.behind > 0)
        parts.push(c.warn(`-${s.behind}`));
      const abStr = parts.length > 0 ? parts.join(" ") : c.dim("-");
      const dirtyStr = s.dirty ? c.warn(`${s.fileCount} changed`) : c.dim("clean");
      tableRows.push([c.pkg(r.pkg.name), branchStr, abStr, dirtyStr]);
    }
    const shown = rows.length;
    const hidden = results.length - shown;
    header(`${ws.name}`);
    console.log();
    table(tableRows);
    if (hidden > 0) {
      console.log();
      empty(`  ${hidden} clean repos hidden (use --all to show)`);
    }
    if (options.diff) {
      const dirty = results.filter((r) => r.result?.dirty);
      if (dirty.length > 0) {
        console.log();
        header("Diffs");
        for (const r of dirty) {
          console.log();
          console.log(`  ${c.pkg(r.pkg.name)}`);
          const stat2 = await r.pkg.diffStat();
          if (stat2.trim()) {
            for (const line of stat2.trim().split(`
`)) {
              console.log(`    ${line}`);
            }
          }
        }
      }
    }
  });
}

// src/commands/ls.ts
function registerLsCommand(program2) {
  program2.command("ls").description("List packages in the workspace").option("--json", "Output as JSON").action(async (options) => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found"));
      process.exit(1);
    }
    const dirs = await ws.allDirs();
    if (options.json) {
      console.log(JSON.stringify(dirs, null, 2));
      return;
    }
    if (dirs.length === 0) {
      empty("No packages found");
      return;
    }
    for (const d of dirs) {
      console.log(`  ${d}`);
    }
  });
}

// src/commands/each.ts
function registerEachCommand(program2) {
  program2.command("each").argument("<cmd...>", "Command to run in each repo").description("Run a command in every repo (parallel)").option("-s, --sequential", "Run sequentially instead of parallel").allowUnknownOption().passThroughOptions().action(async (cmd, options) => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found"));
      process.exit(1);
    }
    const packages = await ws.packages();
    const command = cmd.join(" ");
    if (options.sequential) {
      for (const pkg of packages) {
        console.log(`${c.header(`=== ${pkg.name} ===`)}`);
        const proc = Bun.spawn(["sh", "-c", command], {
          cwd: pkg.path,
          stdout: "inherit",
          stderr: "inherit"
        });
        await proc.exited;
        console.log();
      }
    } else {
      const results = await Promise.allSettled(packages.map(async (pkg) => {
        const proc = Bun.spawn(["sh", "-c", command], {
          cwd: pkg.path,
          stdout: "pipe",
          stderr: "pipe"
        });
        const [stdout, stderr] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text()
        ]);
        const exitCode = await proc.exited;
        return { pkg, stdout, stderr, exitCode };
      }));
      for (const r of results) {
        if (r.status === "fulfilled") {
          const { pkg, stdout, stderr, exitCode } = r.value;
          const hasOutput = stdout.trim() || stderr.trim();
          if (hasOutput || exitCode !== 0) {
            console.log(c.header(`=== ${pkg.name} ===`));
            if (stdout.trim())
              console.log(stdout.trimEnd());
            if (stderr.trim())
              console.log(c.err(stderr.trimEnd()));
            if (exitCode !== 0)
              console.log(c.err(`exit ${exitCode}`));
            console.log();
          }
        } else {
          console.log(c.err(`Failed: ${r.reason}`));
        }
      }
    }
  });
}

// src/commands/clean.ts
import { readdir as readdir2, rename, lstat, mkdtemp } from "fs/promises";
import { join as join2 } from "path";
function registerCleanCommand(program2) {
  program2.command("clean").description("Remove build artifacts (node_modules, build, dist)").option("-n, --dry-run", "Show what would be removed").action(async (options) => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found"));
      process.exit(1);
    }
    const rootDirs = ["node_modules", "build", "dist", "env"];
    const pkgDirs = ["node_modules", "build", "dist"];
    const entries = await readdir2(ws.srcDir, { withFileTypes: true });
    const pkgNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const candidates = [
      ...rootDirs.map((d) => join2(ws.root, d)),
      ...pkgNames.flatMap((name) => pkgDirs.map((d) => join2(ws.srcDir, name, d)))
    ];
    const checks = await Promise.all(candidates.map(async (p) => {
      try {
        const s = await lstat(p);
        return s.isDirectory() ? p : null;
      } catch {
        return null;
      }
    }));
    const targets = checks.filter((p) => p !== null);
    if (targets.length === 0) {
      console.log(c.dim("Nothing to clean"));
      return;
    }
    if (options.dryRun) {
      console.log("Would remove:");
      for (const t of targets) {
        console.log(`  ${c.warn(t.replace(ws.root + "/", ""))}`);
      }
      return;
    }
    const trash = await mkdtemp(join2(ws.root, ".zh-clean-"));
    await Promise.all(targets.map((t, i) => rename(t, join2(trash, `${i}-${t.split("/").pop()}`))));
    console.log(c.ok(`Removed ${targets.length} directories`));
    Bun.spawn(["rm", "-rf", trash], {
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore"
    }).unref();
  });
}

// src/commands/rebase.ts
function registerRebaseCommand(program2) {
  program2.command("rebase").description("Fetch and rebase all clean repos onto mainline").action(async () => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found"));
      process.exit(1);
    }
    const packages = await ws.packages();
    header(`Rebasing ${packages.length} repos...`);
    console.log();
    const results = await parallel(packages, async (pkg) => {
      const status2 = await pkg.status();
      if (status2.dirty) {
        return { action: "skipped", reason: "dirty" };
      }
      await pkg.fetch();
      const result = await pkg.rebase();
      if (result.conflict) {
        return { action: "conflict", reason: "rebase conflict" };
      }
      return { action: "ok", reason: "" };
    });
    const rows = [];
    let okCount = 0;
    let skipCount = 0;
    let conflictCount = 0;
    for (const r of results) {
      if (r.error) {
        rows.push([c.pkg(r.pkg.name), c.err("error")]);
        continue;
      }
      const { action, reason } = r.result;
      switch (action) {
        case "ok":
          okCount++;
          break;
        case "skipped":
          skipCount++;
          rows.push([c.pkg(r.pkg.name), c.warn("SKIP: dirty")]);
          break;
        case "conflict":
          conflictCount++;
          rows.push([c.pkg(r.pkg.name), c.err("CONFLICT")]);
          break;
      }
    }
    if (rows.length > 0) {
      table(rows);
      console.log();
    }
    const parts = [];
    if (okCount > 0)
      parts.push(c.ok(`${okCount} rebased`));
    if (skipCount > 0)
      parts.push(c.warn(`${skipCount} skipped`));
    if (conflictCount > 0)
      parts.push(c.err(`${conflictCount} conflicts`));
    console.log(parts.join(c.dim(" | ")));
  });
}

// src/commands/prep.ts
var import_nanospinner = __toESM(require_dist(), 1);
function registerPrepCommand(program2) {
  program2.command("prep").description("Squash, rebase, and generate commit messages with Claude").option("-n, --dry-run", "Show what would happen without making changes").action(async (options) => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found"));
      process.exit(1);
    }
    const packages = await ws.packages();
    const dirtyPkgs = [];
    for (const pkg of packages) {
      const status2 = await pkg.status();
      if (status2.dirty) {
        dirtyPkgs.push({ pkg, files: status2.files });
      }
    }
    if (dirtyPkgs.length > 0) {
      console.log(c.warn("Dirty repos:"));
      for (const { pkg, files } of dirtyPkgs) {
        console.log(`  ${c.pkg(pkg.name)}:`);
        for (const f of files) {
          console.log(`    ${f}`);
        }
      }
      console.log();
      const yes = await confirm("Commit all with WIP message?");
      if (!yes) {
        console.log("Aborted.");
        process.exit(1);
      }
      for (const { pkg } of dirtyPkgs) {
        await commitAll(pkg.path, "WIP");
      }
      console.log();
    }
    const spinner = import_nanospinner.createSpinner("Fetching...").start();
    const changed = [];
    let skipped = 0;
    await Promise.all(packages.map(async (pkg) => {
      await pkg.fetch().catch(() => {});
      const ab = await pkg.aheadBehind();
      if (ab.ahead > 0) {
        changed.push({ pkg, ahead: ab.ahead });
      } else {
        skipped++;
      }
    }));
    spinner.stop();
    process.stdout.write("\r\x1B[K");
    if (changed.length === 0) {
      empty(`All ${skipped} repos up to date.`);
      return;
    }
    console.log(`${changed.length} repos with changes ${c.dim(`(${skipped} up to date)`)}`);
    console.log();
    if (options.dryRun) {
      for (const { pkg, ahead } of changed) {
        console.log(`  ${c.pkg(pkg.name)}  ${c.dim(`${ahead} commits`)}`);
        const log2 = await pkg.log("origin/mainline..HEAD");
        for (const line of log2.trim().split(`
`)) {
          console.log(`    ${c.dim(line)}`);
        }
      }
      return;
    }
    const spinner2 = import_nanospinner.createSpinner("Squashing...").start();
    const prepResults = [];
    for (const { pkg, ahead } of changed) {
      const branch = await pkg.currentBranch();
      const backup = `backup/${branch}-${dateStamp()}`;
      await createBranch(pkg.path, backup);
      const rebaseResult = await pkg.rebase();
      if (!rebaseResult.success) {
        prepResults.push({ pkg, status: "conflict", backup, ahead });
        continue;
      }
      const origMsgs = await pkg.log("origin/mainline..HEAD", "--format=- %s");
      await resetSoft(pkg.path, "origin/mainline");
      await commitAll(pkg.path, "WIP: squashed for CR");
      const diffStat2 = await pkg.diffStat("origin/mainline");
      const diff2 = (await pkg.diff("origin/mainline")).slice(0, 12000);
      prepResults.push({ pkg, status: "ready", backup, ahead, origMsgs, diffStat: diffStat2, diff: diff2 });
    }
    spinner2.stop();
    process.stdout.write("\r\x1B[K");
    const readyPkgs = prepResults.filter((r) => r.status === "ready");
    const conflictPkgs = prepResults.filter((r) => r.status === "conflict");
    for (const r of prepResults) {
      if (r.status === "ready") {
        console.log(`  ${c.pkg(r.pkg.name)}  ${c.dim(`${r.ahead} commits -> 1`)}`);
      } else {
        console.log(`  ${c.pkg(r.pkg.name)}  ${c.err("CONFLICT")} ${c.dim(`(backup: ${r.backup})`)}`);
      }
    }
    if (readyPkgs.length > 0) {
      console.log();
      const spinner3 = import_nanospinner.createSpinner(`Generating commit messages (${readyPkgs.length} parallel)...`).start();
      const claudeResults = await Promise.allSettled(readyPkgs.map(async (r) => {
        const prompt2 = buildClaudePrompt(r.origMsgs, r.diffStat, r.diff);
        const tmpFile = `/tmp/claude-commit-${r.pkg.name}.txt`;
        const proc = Bun.spawn(["claude", "-p", "--output-format", "text", "--model", "sonnet", "--bare", "--tools", ""], {
          stdin: new Blob([prompt2]),
          stdout: "pipe",
          stderr: "pipe"
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        const match = output.match(/COMMIT_START\n([\s\S]*?)\nCOMMIT_END/);
        if (!match) {
          await Bun.write(tmpFile, output);
          return { pkg: r.pkg, success: false, tmpFile };
        }
        const commitMsg = match[1].trim();
        await amendMessage(r.pkg.path, commitMsg);
        return { pkg: r.pkg, success: true, title: commitMsg.split(`
`)[0] };
      }));
      spinner3.stop();
      process.stdout.write("\r\x1B[K");
      const succeeded = [];
      const failed = [];
      for (const r of claudeResults) {
        if (r.status === "fulfilled") {
          if (r.value.success) {
            succeeded.push({ name: r.value.pkg.name, title: r.value.title });
          } else {
            failed.push({ name: r.value.pkg.name, tmpFile: r.value.tmpFile });
          }
        }
      }
      if (succeeded.length > 0) {
        console.log(c.ok("Ready for CR:"));
        const rows = succeeded.map((s) => [c.pkg(s.name), s.title]);
        table(rows);
      }
      if (failed.length > 0) {
        console.log();
        console.log(c.warn("Failed (run git commit --amend):"));
        const rows = failed.map((f) => [c.pkg(f.name), c.dim(f.tmpFile)]);
        table(rows);
      }
    }
    if (conflictPkgs.length > 0) {
      console.log();
      console.log(c.err("Conflicts (resolve or git rebase --abort):"));
      for (const r of conflictPkgs) {
        console.log(`  ${c.pkg(r.pkg.name)}`);
      }
    }
    if (readyPkgs.length > 0 && conflictPkgs.length === 0) {
      console.log();
      const openCr = await confirmWithTimeout("  Open CR?", 10);
      if (openCr) {
        process.stdout.write(`  ${c.dim("creating...")}`);
        const proc = Bun.spawn(["cr", "--all"], {
          cwd: ws.root,
          stdin: new Blob([`0
`]),
          stdout: "pipe",
          stderr: "pipe"
        });
        const [stdout, stderr] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text()
        ]);
        const exitCode = await proc.exited;
        process.stdout.write("\r" + " ".repeat(40) + "\r");
        if (exitCode === 0) {
          const url = (stdout + stderr).match(/https:\/\/code\.amazon\.com\/reviews\/CR-\S+/);
          if (url) {
            console.log(`  ${c.ok("CR created")}  ${url[0]}`);
          } else {
            console.log(c.ok("  CR created"));
          }
        } else {
          console.log(c.err("  cr failed"));
          const lines = (stdout + stderr).trim().split(`
`).slice(-5);
          for (const line of lines)
            console.log(`  ${c.dim(line)}`);
        }
      }
    }
  });
}
function buildClaudePrompt(origMsgs, diffStat2, diff2) {
  return `Generate a git commit message for this diff. Format:
- Line 1: concise title (max 72 chars, imperative mood)
- Line 2: blank
- Lines 3+: bullet points summarizing key changes

Wrap response in markers exactly like this example:
COMMIT_START
Add label filtering to search API

- Extract label filters from search attributes
- Apply filters as term queries in OpenSearch
- Add unit tests for filter building
COMMIT_END

Original commits:
${origMsgs}

Stat:
${diffStat2}

Diff (truncated, excludes lockfiles):
${diff2}`;
}
function dateStamp() {
  const now = new Date;
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// src/commands/prune.ts
var {$: $2 } = globalThis.Bun;
function registerPruneCommand(program2) {
  program2.command("prune").description("Delete old local and remote branches (yours)").option("-n, --dry-run", "Show what would be deleted").option("--user <username>", "Remote branch owner", "zachhe").action(async (options) => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found"));
      process.exit(1);
    }
    const packages = await ws.packages();
    header(`Pruning branches across ${packages.length} repos...`);
    console.log();
    let totalLocal = 0;
    let totalRemote = 0;
    const results = await parallel(packages, async (pkg) => {
      const deletedLocal = [];
      const deletedRemote = [];
      const current = await pkg.currentBranch();
      const localBranches = await pkg.branches();
      for (const b of localBranches) {
        if (b.name === "mainline" || b.name === current)
          continue;
        if (options.dryRun) {
          deletedLocal.push(b.name);
        } else {
          try {
            await $2`git -C ${pkg.path} branch -D ${b.name}`.quiet();
            deletedLocal.push(b.name);
          } catch {}
        }
      }
      await $2`git -C ${pkg.path} fetch --prune origin`.quiet().catch(() => {});
      const remoteRefs = await $2`git -C ${pkg.path} for-each-ref --format=${"%(refname:short)"} refs/remotes/origin`.text().catch(() => "");
      const userBranches = remoteRefs.trim().split(`
`).filter((b) => b.includes(`/${options.user}/`));
      for (const ref of userBranches) {
        const remoteBranch = ref.replace("origin/", "");
        if (options.dryRun) {
          deletedRemote.push(remoteBranch);
        } else {
          try {
            await $2`git -C ${pkg.path} push origin --delete ${remoteBranch}`.quiet();
            deletedRemote.push(remoteBranch);
          } catch {}
        }
      }
      return { deletedLocal, deletedRemote };
    });
    for (const r of results) {
      if (r.error)
        continue;
      const { deletedLocal, deletedRemote } = r.result;
      if (deletedLocal.length === 0 && deletedRemote.length === 0)
        continue;
      console.log(`${c.pkg(r.pkg.name)}`);
      for (const b of deletedLocal) {
        const prefix = options.dryRun ? "would delete" : "deleted";
        console.log(`  ${c.dim("local:")}  ${b}`);
        totalLocal++;
      }
      for (const b of deletedRemote) {
        console.log(`  ${c.dim("remote:")} ${b}`);
        totalRemote++;
      }
    }
    console.log();
    const verb = options.dryRun ? "Would delete" : "Deleted";
    console.log(`${verb} ${totalLocal} local, ${totalRemote} remote branches`);
  });
}

// src/commands/build.ts
import { existsSync as existsSync3 } from "fs";
import { join as join5 } from "path";

// src/domain/build.ts
import { existsSync as existsSync2, readFileSync } from "fs";
import { join as join3 } from "path";
function detect(pkg) {
  const configBuildSystem = readBuildSystem(pkg.path);
  const gradlePath = join3(pkg.path, "build.gradle.kts");
  const pkgJsonPath = join3(pkg.path, "package.json");
  if (existsSync2(gradlePath)) {
    return detectGradle(pkg, gradlePath);
  }
  if (existsSync2(pkgJsonPath)) {
    return detectNpm(pkg, pkgJsonPath);
  }
  if (configBuildSystem && configBuildSystem !== "no-op") {
    return {
      system: "brazil",
      testCommand: null,
      integTestCommand: null,
      buildCommand: "brazil-build",
      isIntegTestPackage: false
    };
  }
  return {
    system: "none",
    testCommand: null,
    integTestCommand: null,
    buildCommand: "brazil-build",
    isIntegTestPackage: false
  };
}
function readBuildSystem(pkgPath) {
  try {
    const config = readFileSync(join3(pkgPath, "Config"), "utf-8");
    const match = config.match(/build-system\s*=\s*([^;\s]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
function detectGradle(pkg, gradlePath) {
  const content = readFileSync(gradlePath, "utf-8");
  const isInteg = pkg.name.toLowerCase().includes("integrationtests");
  const hasJUnit = content.includes("useJUnitPlatform");
  const hasIntegTask = content.includes("integTest");
  return {
    system: "gradle",
    testCommand: hasJUnit && !isInteg ? "brazil-build test" : null,
    integTestCommand: hasIntegTask || isInteg ? "brazil-build integTest" : null,
    buildCommand: "brazil-build",
    isIntegTestPackage: isInteg
  };
}
function detectNpm(pkg, pkgJsonPath) {
  let scripts = {};
  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    scripts = pkgJson.scripts ?? {};
  } catch {}
  const isInteg = pkg.name.toLowerCase().includes("integrationtests");
  const testScript = scripts.test ?? "";
  const hasUnitTests = !!testScript && !testScript.includes("echo 'No tests'") && !testScript.includes('echo "No tests"') && !testScript.includes('echo "Error: no test specified"');
  const hasIntegTests = !!scripts["test:integration"];
  return {
    system: "npm",
    testCommand: hasUnitTests && !isInteg ? "npm test" : null,
    integTestCommand: hasIntegTests ? "npm run test:integration" : null,
    buildCommand: "brazil-build",
    isIntegTestPackage: isInteg
  };
}

// src/domain/deps.ts
var cachedGraph = null;
async function getDependencyGraph(wsRoot) {
  if (cachedGraph)
    return cachedGraph;
  try {
    cachedGraph = await graphFromBrazil(wsRoot);
  } catch {
    cachedGraph = { edges: new Map, transitive: new Map, order: [] };
  }
  return cachedGraph;
}
function topologicalLevels(targets, graph) {
  if (targets.length <= 1)
    return targets.length === 1 ? [targets] : [];
  const targetNames = new Set(targets.map((p) => p.name));
  const byName = new Map(targets.map((p) => [p.name, p]));
  const inDegree = new Map;
  const localDeps = new Map;
  for (const name of targetNames) {
    const allDeps = graph.transitive.get(name) ?? new Set;
    const filtered = new Set([...allDeps].filter((d) => targetNames.has(d)));
    localDeps.set(name, filtered);
    inDegree.set(name, filtered.size);
  }
  const levels = [];
  while (inDegree.size > 0) {
    const ready = [];
    for (const [name, deg] of inDegree) {
      if (deg === 0)
        ready.push(name);
    }
    if (ready.length === 0) {
      levels.push([...inDegree.keys()].map((n) => byName.get(n)));
      break;
    }
    levels.push(ready.map((n) => byName.get(n)));
    for (const name of ready) {
      inDegree.delete(name);
    }
    for (const [other, deps] of localDeps) {
      if (!inDegree.has(other))
        continue;
      for (const name of ready) {
        if (deps.has(name)) {
          deps.delete(name);
          inDegree.set(other, (inDegree.get(other) ?? 1) - 1);
        }
      }
    }
  }
  return levels;
}
function expandTargets(targetNames, graph) {
  const expanded = new Set(targetNames);
  let changed = true;
  while (changed) {
    changed = false;
    for (const target of [...expanded]) {
      const deps = graph.transitive.get(target) ?? new Set;
      for (const dep of deps) {
        if (expanded.has(dep))
          continue;
        if (!graph.edges.has(dep))
          continue;
        const depTransitive = graph.transitive.get(dep) ?? new Set;
        const dependsOnTarget = [...expanded].some((t) => depTransitive.has(t));
        if (dependsOnTarget) {
          expanded.add(dep);
          changed = true;
        }
      }
    }
  }
  return expanded;
}
async function graphFromBrazil(wsRoot) {
  const proc = Bun.spawn([
    "brazil-recursive-cmd",
    "--allPackages",
    'echo "${name}|${dependencies}|${alldependencies}"'
  ], {
    cwd: wsRoot,
    stdout: "pipe",
    stderr: "pipe"
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error("brazil-recursive-cmd failed");
  }
  const edges = new Map;
  const transitive = new Map;
  const order = [];
  for (const line of stdout.split(`
`)) {
    const parts = line.split("|");
    if (parts.length < 3)
      continue;
    const pkgName = parts[0].trim();
    if (!pkgName)
      continue;
    order.push(pkgName);
    edges.set(pkgName, parseDeps(parts[1]));
    transitive.set(pkgName, parseDeps(parts[2]));
  }
  return { edges, transitive, order };
}
function parseDeps(raw) {
  const deps = new Set;
  const trimmed = raw.trim();
  if (!trimmed)
    return deps;
  for (const dep of trimmed.split(",")) {
    const name = dep.replace(/-\d+\.\d+$/, "");
    if (name)
      deps.add(name);
  }
  return deps;
}

// src/domain/deploy.ts
var {$: $3 } = globalThis.Bun;

// src/domain/stages.ts
var STAGES = {
  devo: {
    account: "672626785854",
    region: "us-east-1",
    confirmLevel: "none",
    logGroup: "/arcc/Devo/lambda/iam"
  },
  beta: {
    account: "187192759204",
    region: "us-east-1",
    confirmLevel: "prompt",
    logGroup: "/arcc/Beta/lambda/iam"
  },
  gamma: {
    account: "674428709295",
    region: "us-east-1",
    confirmLevel: "type-name",
    logGroup: "/arcc/Gamma/lambda/iam"
  },
  prod: {
    account: "785772043933",
    region: "us-east-1",
    confirmLevel: "refuse",
    logGroup: "/arcc/Prod/lambda/iam"
  }
};
var DEFAULT_STAGE = "devo";
var PIPELINE_URL = "https://pipelines.amazon.com/pipelines/ArccApp";
function getStage(name) {
  return STAGES[name.toLowerCase()];
}
function stageDisplayName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// src/lib/cache.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, mkdirSync } from "fs";
import { join as join4 } from "path";
import { homedir } from "os";
var CACHE_DIR = join4(homedir(), ".cache", "zh");
function ensureDir() {
  mkdirSync(CACHE_DIR, { recursive: true });
}
function get(key, ttlMs) {
  try {
    const path = join4(CACHE_DIR, `${key}.json`);
    const raw = readFileSync2(path, "utf-8");
    const entry = JSON.parse(raw);
    if (ttlMs !== undefined) {
      const age = Date.now() - entry.timestamp;
      if (age > ttlMs)
        return;
    }
    return entry.data;
  } catch {
    return;
  }
}
function set(key, data) {
  ensureDir();
  const path = join4(CACHE_DIR, `${key}.json`);
  const entry = { data, timestamp: Date.now() };
  writeFileSync2(path, JSON.stringify(entry, null, 2));
}
function invalidate(key) {
  try {
    const path = join4(CACHE_DIR, `${key}.json`);
    __require("fs").unlinkSync(path);
  } catch {}
}

// src/domain/deploy.ts
var KNOWN_STACKS = ["Service", "FoundationalResources", "BuilderToolbox"];
var SHORT_ALIASES = {
  svc: "Service",
  fr: "FoundationalResources"
};
function parseTarget(input) {
  const atIdx = input.lastIndexOf("@");
  if (atIdx > 0) {
    return {
      query: input.slice(0, atIdx),
      stage: input.slice(atIdx + 1)
    };
  }
  return { query: input };
}
function fullStackName(shortName, stage) {
  return `ArccApp-${stageDisplayName(stage)}-0-${shortName}`;
}
function matchStack(query) {
  const lower = query.toLowerCase();
  const aliased = SHORT_ALIASES[lower];
  if (aliased)
    return [aliased];
  const exact = KNOWN_STACKS.filter((s) => s.toLowerCase() === lower);
  if (exact.length > 0)
    return exact;
  return KNOWN_STACKS.filter((s) => s.toLowerCase().includes(lower));
}
function allStacks(stage) {
  return KNOWN_STACKS.map((s) => fullStackName(s, stage));
}
var LEDGER_KEY = "deploy-ledger";
function getHistory() {
  return get(LEDGER_KEY) ?? [];
}
function getLastDeploy() {
  const history = getHistory();
  return history.length > 0 ? history[0] : undefined;
}
function recordDeploy(record) {
  const history = getHistory();
  history.unshift(record);
  set(LEDGER_KEY, history.slice(0, 50));
}
async function getPackageShas(ws) {
  const packages = await ws.packages();
  const shas = {};
  await Promise.all(packages.map(async (pkg) => {
    try {
      const sha = (await $3`git -C ${pkg.path} rev-parse --short HEAD`.quiet().text()).trim();
      shas[pkg.name] = sha;
    } catch {
      shas[pkg.name] = "unknown";
    }
  }));
  return shas;
}
async function getChangedPackages(ws, recordedShas) {
  const currentShas = await getPackageShas(ws);
  const changed = [];
  for (const [name, sha] of Object.entries(currentShas)) {
    if (!recordedShas[name] || recordedShas[name] !== sha) {
      changed.push(name);
    }
  }
  return changed;
}

// src/commands/build.ts
function registerBuildCommand(program2) {
  program2.command("build").argument("[query]", "Package name (fuzzy match)").description("Build packages (smart defaults)").option("-a, --all", "Build all packages (recursive, like bbb)").option("-d, --dirty", "Build only packages with uncommitted changes").option("--changed", "Build packages changed since last deploy").option("--full", "Full recursive build via brazil-recursive-cmd").option("--stream", "Stream build output instead of capturing").option("--fmt", "Run ktlintFormat before building (Gradle packages)").action(async (query, options) => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found (no packageInfo in parent dirs)"));
      process.exit(1);
    }
    if (options.full || options.all) {
      await buildRecursive(ws, options);
      return;
    }
    let targets = await resolveTargets(ws, query, options);
    if (targets.length === 0)
      return;
    if (targets.length > 1) {
      const graph = await getDependencyGraph(ws.root);
      const targetNames = new Set(targets.map((p) => p.name));
      const expanded = expandTargets(targetNames, graph);
      if (expanded.size > targetNames.size) {
        const allPkgs = await ws.allSrcPackages();
        const byName = new Map(allPkgs.map((p) => [p.name, p]));
        const added = [];
        for (const name of expanded) {
          if (!targetNames.has(name)) {
            const pkg = byName.get(name);
            if (pkg && detect(pkg).system !== "none") {
              targets.push(pkg);
              added.push(name);
            }
          }
        }
        if (added.length > 0) {
          console.log(c.dim(`  +${added.map((n) => c.pkg(n)).join(", ")} (dependency path)
`));
        }
      }
    }
    const startTime = Date.now();
    let results;
    if (targets.length === 1) {
      results = await buildSequential(targets, options);
    } else {
      const graph = await getDependencyGraph(ws.root);
      const levels = topologicalLevels(targets, graph);
      if (levels.length > 1) {
        for (let i = 0;i < levels.length; i++) {
          const names = levels[i].map((p) => c.pkg(p.name)).join(", ");
          const par = levels[i].length > 1 ? c.dim(" (parallel)") : "";
          console.log(`  ${c.dim(`${i + 1}.`)} ${names}${par}`);
        }
        console.log();
      } else if (targets.length > 1) {
        console.log(`  ${c.bold(`${targets.length}`)} packages to build ${c.dim("(parallel)")}
`);
      }
      if (options.stream) {
        results = await buildSequential(levels.flat(), options);
      } else {
        results = await buildByLevel(levels, graph, options);
      }
    }
    const totalMs = Date.now() - startTime;
    printSummary(results, totalMs);
    saveBuildShas(results.filter((r) => r.ok));
    if (results.some((r) => !r.ok))
      process.exit(1);
  });
}
async function resolveTargets(ws, query, options) {
  if (query) {
    const matches = await ws.findPackage(query);
    if (matches.length === 0) {
      console.error(c.err(`No package matching '${query}'`));
      process.exit(1);
    }
    if (matches.length === 1)
      return [matches[0]];
    const selected = await fzfSelect(matches.map((p) => p.name));
    return [matches.find((p) => p.name === selected)];
  }
  if (options.changed) {
    const last2 = getLastDeploy();
    if (!last2) {
      console.log(c.dim(`  No deploy history. Building dirty packages instead.
`));
      return getDirtyBuildablePackages(ws);
    }
    const changedNames = await getChangedPackages(ws, last2.shas);
    if (changedNames.length === 0) {
      empty("  No packages changed since last deploy.");
      return [];
    }
    const all = await ws.packages();
    const changed = all.filter((p) => changedNames.includes(p.name));
    return filterBuildable(changed);
  }
  if (options.dirty) {
    return getDirtyBuildablePackages(ws);
  }
  const current = ws.currentPackage();
  if (current) {
    return [current];
  }
  const dirty = await getDirtyBuildablePackages(ws);
  const unbuilt = getUnbuiltPackages(ws, await ws.packages());
  const seen = new Set(dirty.map((p) => p.name));
  const merged = [...dirty];
  for (const pkg of unbuilt) {
    if (!seen.has(pkg.name)) {
      merged.push(pkg);
      seen.add(pkg.name);
    }
  }
  if (merged.length > 0) {
    const parts = [];
    if (dirty.length > 0)
      parts.push(`${dirty.length} dirty`);
    if (unbuilt.length > 0)
      parts.push(`${unbuilt.length} unbuilt`);
    console.log(c.dim(`  ${parts.join(", ")}
`));
    return merged;
  }
  const last = getLastDeploy();
  if (last) {
    const changedNames = await getChangedPackages(ws, last.shas);
    if (changedNames.length > 0) {
      const all = await ws.packages();
      const changed = filterBuildable(all.filter((p) => changedNames.includes(p.name)));
      if (changed.length > 0) {
        console.log(c.dim(`  ${changed.length} changed since last deploy
`));
        return changed;
      }
    }
  }
  empty("  Nothing to build. Use zh build <pkg> or zh build -a");
  return [];
}
async function getDirtyBuildablePackages(ws) {
  const all = await ws.packages();
  const dirty = [];
  for (const pkg of all) {
    const status2 = await pkg.status();
    if (status2.dirty)
      dirty.push(pkg);
  }
  return filterBuildable(dirty);
}
function filterBuildable(packages) {
  return packages.filter((p) => {
    const info = detect(p);
    return info.system !== "none";
  });
}
function getUnbuiltPackages(ws, packages) {
  return filterBuildable(packages).filter((pkg) => {
    return !existsSync3(join5(ws.root, "build", pkg.name));
  });
}
function buildArgs(pkg, options) {
  const info = detect(pkg);
  if (options.fmt && info.system === "gradle") {
    return ["brazil-build", "ktlintFormat", "release"];
  }
  return info.buildCommand.split(/\s+/);
}
async function buildOne(pkg, options, onError) {
  const startTime = Date.now();
  const logFile = makeBuildLogPath(pkg.name);
  const logWriter = Bun.file(logFile).writer();
  const chunks = [];
  const args = buildArgs(pkg, options);
  const proc = Bun.spawn(args, {
    cwd: pkg.path,
    stdout: "pipe",
    stderr: "pipe"
  });
  function handleLine(line) {
    logWriter.write(line + `
`);
    chunks.push(line);
    if (onError) {
      const trimmed = line.trimStart();
      if (ERROR_PATTERNS.some((p) => p.test(trimmed))) {
        onError(trimmed);
      }
    }
  }
  const [, , exitCode] = await Promise.all([
    readLines(proc.stdout, handleLine),
    readLines(proc.stderr, handleLine),
    proc.exited
  ]);
  logWriter.end();
  return {
    pkg,
    ok: exitCode === 0,
    durationMs: Date.now() - startTime,
    output: chunks.join(`
`),
    logFile
  };
}
async function buildOneStreamed(pkg, options) {
  const startTime = Date.now();
  const logFile = makeBuildLogPath(pkg.name);
  const args = buildArgs(pkg, options);
  const proc = Bun.spawn(args, {
    cwd: pkg.path,
    stdout: "inherit",
    stderr: "inherit"
  });
  const exitCode = await proc.exited;
  return { pkg, ok: exitCode === 0, durationMs: Date.now() - startTime, output: "", logFile };
}
async function buildSequential(targets, options) {
  const results = [];
  for (const pkg of targets) {
    const info = detect(pkg);
    const fmtNote = options.fmt && info.system === "gradle" ? " (fmt + build)" : "";
    console.log(`  ${c.pkg(pkg.name)}${c.dim(fmtNote)}`);
    if (targets.length > 1) {
      separator();
      console.log();
    }
    const result = options.stream ? await buildOneStreamed(pkg, options) : await buildOneLive(pkg, options);
    results.push(result);
    if (targets.length > 1) {
      const status2 = result.ok ? c.ok(`built (${formatDuration(result.durationMs)})`) : c.err(`FAILED (${formatDuration(result.durationMs)})`);
      console.log(`  ${c.pkg(pkg.name)}  ${status2}`);
      console.log();
    }
  }
  return results;
}
async function buildOneLive(pkg, options) {
  const info = detect(pkg);
  let hasErrors = false;
  process.stdout.write(`  ${c.dim("building...")}`);
  const result = await buildOne(pkg, options, (errorLine) => {
    if (!hasErrors) {
      process.stdout.write("\r" + " ".repeat(60) + "\r");
      hasErrors = true;
    }
    console.log(`  ${errorLine}`);
  });
  if (!hasErrors) {
    process.stdout.write("\r" + " ".repeat(60) + "\r");
  }
  if (result.ok) {
    const fmtNote = options.fmt && info.system === "gradle" ? c.dim(" (fmt)") : "";
    console.log(`  ${c.pkg(pkg.name)}${fmtNote}  ${c.ok("built")} ${c.dim(`(${formatDuration(result.durationMs)})`)}`);
  } else {
    console.log(`  ${c.pkg(pkg.name)}  ${c.err("FAILED")} ${c.dim(`(${formatDuration(result.durationMs)})`)}`);
    if (!hasErrors) {
      separator();
      console.log();
      for (const line of extractFailureOutput(result.output)) {
        console.log(line);
      }
    }
    console.log(c.dim(`  log: ${result.logFile}`));
    console.log();
  }
  return result;
}
async function buildByLevel(levels, graph, options) {
  const allResults = [];
  const failed = new Set;
  for (const level of levels) {
    const buildable = [];
    for (const pkg of level) {
      const deps = graph.transitive.get(pkg.name) ?? new Set;
      const failedDep = [...deps].find((d) => failed.has(d));
      if (failedDep) {
        console.log(`  ${c.pkg(pkg.name)}  ${c.dim("skipped")} ${c.dim(`(${failedDep} failed)`)}`);
        allResults.push({ pkg, ok: false, durationMs: 0, output: "", logFile: "" });
        failed.add(pkg.name);
      } else {
        buildable.push(pkg);
      }
    }
    if (buildable.length === 0)
      continue;
    let levelResults;
    if (buildable.length === 1) {
      levelResults = [await buildOneLive(buildable[0], options)];
    } else {
      levelResults = await buildParallelBatch(buildable, options);
    }
    for (const r of levelResults) {
      if (!r.ok)
        failed.add(r.pkg.name);
    }
    allResults.push(...levelResults);
  }
  return allResults;
}
async function buildParallelBatch(targets, options) {
  for (const pkg of targets) {
    console.log(`  ${c.pkg(pkg.name)}  ${c.dim("building...")}`);
  }
  const moveUp = (n) => process.stdout.write(`\x1B[${n}A`);
  const results = await Promise.all(targets.map(async (pkg) => {
    const result = await buildOne(pkg, options);
    const idx = targets.indexOf(pkg);
    moveUp(targets.length - idx);
    const info = detect(pkg);
    const fmtNote = options.fmt && info.system === "gradle" ? c.dim(" (fmt)") : "";
    if (result.ok) {
      process.stdout.write(`\r  ${c.pkg(pkg.name)}${fmtNote}  ${c.ok("built")} ${c.dim(`(${formatDuration(result.durationMs)})`)}${"".padEnd(20)}
`);
    } else {
      process.stdout.write(`\r  ${c.pkg(pkg.name)}  ${c.err("FAILED")} ${c.dim(`(${formatDuration(result.durationMs)})`)}${"".padEnd(20)}
`);
    }
    const moveDown = targets.length - idx - 1;
    if (moveDown > 0)
      process.stdout.write(`\x1B[${moveDown}B`);
    return result;
  }));
  console.log();
  const failures = results.filter((r) => !r.ok);
  for (const r of failures) {
    console.log(`  ${c.pkg(r.pkg.name)} ${c.err("build output:")}`);
    separator();
    console.log();
    for (const line of extractFailureOutput(r.output)) {
      console.log(line);
    }
    console.log(c.dim(`  log: ${r.logFile}`));
    console.log();
  }
  return results;
}
async function buildRecursive(ws, options) {
  console.log(c.dim("  building all packages (brazil-recursive-cmd)..."));
  if (options.stream) {
    separator();
    console.log();
    const proc2 = Bun.spawn(["brazil-recursive-cmd", "brazil-build", "release", "--allPackages"], { cwd: ws.root, stdout: "inherit", stderr: "inherit" });
    const exitCode2 = await proc2.exited;
    console.log();
    if (exitCode2 === 0) {
      console.log(c.ok("  all packages built"));
    } else {
      console.log(c.err("  recursive build failed"));
      process.exit(1);
    }
    return;
  }
  const startTime = Date.now();
  process.stdout.write(`  ${c.dim("building...")}`);
  const proc = Bun.spawn(["brazil-recursive-cmd", "brazil-build", "release", "--allPackages"], { cwd: ws.root, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ]);
  const exitCode = await proc.exited;
  const durationMs = Date.now() - startTime;
  process.stdout.write("\r" + " ".repeat(60) + "\r");
  if (exitCode === 0) {
    console.log(`  ${c.ok("all packages built")} ${c.dim(`(${formatDuration(durationMs)})`)}`);
  } else {
    console.log(`  ${c.err("recursive build failed")} ${c.dim(`(${formatDuration(durationMs)})`)}`);
    separator();
    console.log();
    for (const line of extractFailureOutput((stdout + `
` + stderr).trim())) {
      console.log(line);
    }
    console.log();
    process.exit(1);
  }
}
function printSummary(results, totalMs) {
  if (results.length <= 1) {
    if (results.length === 1 && !results[0].ok) {} else if (results.length === 1 && results[0].ok) {}
    return;
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log();
  if (failed === 0) {
    console.log(`  ${c.ok(`${passed}/${results.length} built`)} ${c.dim(`(${formatDuration(totalMs)})`)}`);
  } else {
    console.log(`  ${c.ok(`${passed}`)} built, ${c.err(`${failed} failed`)} ${c.dim(`(${formatDuration(totalMs)})`)}`);
  }
}
function makeBuildLogPath(pkgName) {
  const ts = new Date().toISOString().replace(/[T:]/g, "-").slice(0, 19);
  return `/tmp/zh-build-${pkgName}-${ts}.log`;
}
async function readLines(stream, onLine) {
  const reader = stream.getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(`
`);
    buffer = lines.pop();
    for (const line of lines) {
      onLine(line);
    }
  }
  if (buffer.length > 0) {
    onLine(buffer);
  }
}
var ERROR_PATTERNS = [
  /^e: .*\.\w+:\d+/,
  /^FAILURE:/,
  /^BUILD FAILED/,
  /^> Task .* FAILED/,
  /^Execution failed for task/
];
var FAILURE_EXTRACT_PATTERNS = [
  ...ERROR_PATTERNS,
  /^e: /,
  /^error:/i,
  /^What went wrong:/,
  /^ERROR:/
];
function extractFailureOutput(output) {
  const lines = output.split(`
`);
  let errorStart = -1;
  for (let i = 0;i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (FAILURE_EXTRACT_PATTERNS.some((p) => p.test(trimmed))) {
      errorStart = i;
      break;
    }
  }
  if (errorStart >= 0) {
    return lines.slice(errorStart, errorStart + 80).filter((l) => l.trim());
  }
  return lines.slice(-60).filter((l) => l.trim());
}
var BUILD_SHAS_KEY = "build-shas";
function getLastBuildShas() {
  const record = get(BUILD_SHAS_KEY);
  return record?.shas ?? {};
}
function saveBuildShas(builtPackages) {
  if (builtPackages.length === 0)
    return;
  const existing = getLastBuildShas();
  for (const r of builtPackages) {
    try {
      const proc = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"], { cwd: r.pkg.path });
      const sha = new TextDecoder().decode(proc.stdout).trim();
      if (sha)
        existing[r.pkg.name] = sha;
    } catch {}
  }
  set(BUILD_SHAS_KEY, { shas: existing });
}

// src/domain/credentials.ts
var {$: $4 } = globalThis.Bun;
var MIN_REMAINING_MINUTES = 10;
async function checkCredentials() {
  try {
    const result = await $4`aws sts get-caller-identity --output json`.quiet().text();
    const identity = JSON.parse(result.trim());
    const minutesRemaining = await getCredentialMinutesRemaining();
    return {
      valid: true,
      account: identity.Account,
      arn: identity.Arn,
      minutesRemaining
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Could not validate credentials"
    };
  }
}
async function getCredentialMinutesRemaining(account) {
  try {
    const role = account ? getCachedRole(account) : undefined;
    if (!account || !role)
      return;
    const proc = Bun.spawn(["ada", "credentials", "print", "--account", account, "--role", role, "--provider", "conduit"], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0)
      return;
    const json = JSON.parse(output.trim());
    if (json.Expiration) {
      const expiry = new Date(json.Expiration);
      return Math.floor((expiry.getTime() - Date.now()) / 60000);
    }
    return;
  } catch {
    return;
  }
}
async function refreshCredentials(account) {
  let role = getCachedRole(account);
  if (!role) {
    const roles = await discoverRoles(account);
    if (roles.length === 1) {
      role = roles[0];
      console.log(`  ${c.dim("role")}   ${role}`);
    } else if (roles.length > 1) {
      console.log(c.dim("  select a role for this account:"));
      console.log();
      role = await fzfSelect(roles);
    } else {
      console.log(c.dim("  ada needs a role for this account."));
      console.log(c.dim("  (this will be remembered for next time)"));
      console.log();
      const { createInterface } = __require("readline");
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      role = await new Promise((resolve) => {
        rl.question(`  ${c.bold("role name")}: `, (ans) => {
          rl.close();
          resolve(ans.trim());
        });
      });
    }
    if (!role)
      return false;
    cacheRole(account, role);
  }
  return runAda(account, role);
}
async function discoverRoles(account) {
  try {
    const proc = Bun.spawn(["ada", "credentials", "list-roles", "--account", account, "--provider", "conduit"], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode === 0 && output.trim()) {
      return output.trim().split(`
`).map((l) => l.trim()).filter(Boolean);
    }
  } catch {}
  return [];
}
async function runAda(account, role) {
  const proc = Bun.spawn(["ada", "credentials", "update", "--account", account, "--role", role, "--provider", "conduit", "--once"], { stdout: "inherit", stderr: "inherit" });
  return await proc.exited === 0;
}
async function ensureCredentials(targetAccount) {
  let creds = await checkCredentials();
  if (creds.valid) {
    const remaining = await getCredentialMinutesRemaining(targetAccount);
    if (remaining !== undefined && remaining < MIN_REMAINING_MINUTES) {
      console.log(`  ${c.dim("creds")}  ${c.warn(`${remaining}m remaining`)} ${c.dim("-- refreshing...")}`);
      const refreshed2 = await refreshCredentials(targetAccount);
      if (refreshed2) {
        creds = await checkCredentials();
        console.log(`  ${c.dim("creds")}  ${c.ok("refreshed")} ${c.dim(`(${creds.account})`)}`);
      } else {
        console.log(`  ${c.dim("creds")}  ${c.warn(`${remaining}m remaining -- ada refresh failed`)}`);
      }
      return creds;
    }
    const timeInfo = remaining !== undefined ? ` ${remaining}m` : "";
    console.log(`  ${c.dim("creds")}  ${c.ok("valid")}${c.dim(timeInfo)} ${c.dim(`(${creds.account})`)}`);
    return creds;
  }
  console.log(`  ${c.dim("creds")}  ${c.warn("expired")} ${c.dim("-- refreshing via ada...")}`);
  console.log();
  const refreshed = await refreshCredentials(targetAccount);
  if (!refreshed) {
    console.log(`  ${c.dim("creds")}  ${c.err("ada failed")} ${c.dim("-- credentials may not work")}`);
    return { valid: false, error: "ADA credential refresh failed" };
  }
  creds = await checkCredentials();
  if (creds.valid) {
    console.log(`  ${c.dim("creds")}  ${c.ok("refreshed")} ${c.dim(`(${creds.account})`)}`);
  } else {
    console.log(`  ${c.dim("creds")}  ${c.err("still invalid after ada refresh")}`);
  }
  return creds;
}
var ROLE_CACHE_KEY = "ada-roles";
function getCachedRole(account) {
  const roles = get(ROLE_CACHE_KEY);
  return roles?.[account];
}
function cacheRole(account, role) {
  const roles = get(ROLE_CACHE_KEY) ?? {};
  roles[account] = role;
  set(ROLE_CACHE_KEY, roles);
}

// src/commands/test.ts
function registerTestCommand(program2) {
  program2.command("test").argument("[query]", "Package name (fuzzy match)").description("Run tests (unit by default, integration with -i)").option("-a, --all", "Run tests in all testable packages").option("-i, --integration", "Run integration tests (used by zhi)").option("-r, --retry", "Rerun only the failed tests from the last run").option("--stage <stage>", "Stage for integration tests", DEFAULT_STAGE).option("--region <region>", "AWS region for integration tests", "us-east-1").allowUnknownOption().passThroughOptions().action(async (query, options) => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found (no packageInfo in parent dirs)"));
      process.exit(1);
    }
    let passthrough = getPassthroughArgs();
    if (options.retry) {
      const prev = loadFailureCache();
      if (!prev) {
        console.error(c.err("No previous test failures to retry"));
        process.exit(1);
      }
      console.log(`  ${c.dim("retrying")} ${c.bold(`${prev.testFilters.length}`)} failed test${prev.testFilters.length !== 1 ? "s" : ""} ${c.dim(`from ${formatRelativeTime(new Date(prev.timestamp).toISOString())}`)}`);
      for (const t of prev.testFilters) {
        console.log(`    ${c.dim(t)}`);
      }
      console.log();
      query = prev.packageName;
      options.integration = true;
      options.stage = prev.stage;
      options.region = prev.region;
      passthrough = [...passthrough, ...prev.testFilters.flatMap((t) => ["--tests", t])];
    }
    if (options.integration) {
      await runIntegrationTests(ws, query, options, passthrough);
    } else {
      await runUnitTests(ws, query, options, passthrough);
    }
  });
}
async function runUnitTests(ws, query, options, passthrough) {
  let packages;
  if (options.all) {
    const all = await ws.packages();
    packages = all.filter((p) => {
      const info = detect(p);
      return info.testCommand !== null || info.isIntegTestPackage;
    });
    if (packages.length === 0) {
      empty("No testable packages found.");
      return;
    }
  } else if (query) {
    const matches = await ws.findPackage(query);
    if (matches.length === 0) {
      console.error(c.err(`No package matching '${query}'`));
      process.exit(1);
    }
    packages = matches.length === 1 ? [matches[0]] : [await selectWithDefault(matches, LAST_UNIT_PKG_CACHE)];
  } else {
    const current = ws.currentPackage();
    if (current) {
      packages = [current];
    } else {
      packages = await findDirtyTestablePackages(ws);
      if (packages.length === 0) {
        const all = await ws.packages();
        const testable = all.filter((p) => detect(p).testCommand !== null);
        const lastPkg = get(LAST_UNIT_PKG_CACHE);
        if (lastPkg && testable.find((p) => p.name === lastPkg)) {
          const useDefault = await confirmWithTimeout(`  ${c.pkg(lastPkg)}?`, 5);
          if (useDefault) {
            packages = [testable.find((p) => p.name === lastPkg)];
          } else {
            packages = [await selectWithDefault(testable, LAST_UNIT_PKG_CACHE)];
          }
        } else {
          empty("No dirty packages with tests. Use zh test <pkg> or zh test -a");
          return;
        }
      } else {
        console.log(c.dim(`  ${packages.length} dirty package${packages.length > 1 ? "s" : ""} with tests
`));
      }
    }
  }
  const results = [];
  for (const pkg of packages) {
    const info = detect(pkg);
    if (info.isIntegTestPackage && info.integTestCommand) {
      console.log(`  ${c.pkg(pkg.name)} ${c.dim("(integration test package)")}`);
      console.log(c.dim(`  ${info.integTestCommand}`));
      separator();
      console.log();
      const ok = await streamCommand(pkg.path, info.integTestCommand, passthrough);
      results.push({ pkg, ok });
    } else if (info.testCommand) {
      console.log(`  ${c.pkg(pkg.name)} ${c.dim(info.testCommand)}`);
      separator();
      console.log();
      const ok = await streamCommand(pkg.path, info.testCommand, passthrough);
      results.push({ pkg, ok });
    } else if (!options.all) {
      console.log(`  ${c.pkg(pkg.name)}  ${c.dim("no tests")}`);
    }
    if (packages.length > 1 && results.length < packages.length)
      console.log();
  }
  if (packages.length === 1) {
    saveLastPkg(LAST_UNIT_PKG_CACHE, packages[0]);
  }
  if (results.length > 1) {
    printRunSummary(results);
  } else if (results.length === 1) {
    console.log();
    console.log(results[0].ok ? c.ok("  passed") : c.err("  failed"));
  }
  if (results.some((r) => !r.ok))
    process.exit(1);
}
async function runIntegrationTests(ws, query, options, passthrough) {
  const stageConfig = getStage(options.stage);
  const stageName = options.stage.charAt(0).toUpperCase() + options.stage.slice(1).toLowerCase();
  const targetAccount = stageConfig?.account ?? "672626785854";
  console.log(c.dim("  pre-flight"));
  await ensureCredentials(targetAccount);
  console.log(`  ${c.dim("stage")}  ${c.bold(stageName)} ${c.dim(`(${options.region})`)}`);
  console.log();
  const integPkgs = await ws.findIntegTestPackages();
  if (integPkgs.length === 0) {
    console.error(c.err("No integration test packages found"));
    process.exit(1);
  }
  let targets;
  if (options.all) {
    targets = integPkgs;
  } else if (query) {
    const matches = integPkgs.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    if (matches.length === 0) {
      console.error(c.err(`No integration test package matching '${query}'`));
      console.log(c.dim(`  Available: ${integPkgs.map((p) => p.name).join(", ")}`));
      process.exit(1);
    }
    targets = matches.length === 1 ? [matches[0]] : [await selectWithDefault(matches, LAST_INTEG_PKG_CACHE)];
  } else if (integPkgs.length === 1) {
    targets = [integPkgs[0]];
  } else {
    targets = [await selectWithDefault(integPkgs, LAST_INTEG_PKG_CACHE)];
  }
  for (const pkg of targets) {
    console.log(`  ${c.dim("building")} ${c.pkg(pkg.name)}${c.dim("...")}`);
    const buildResult = await capturedExec(pkg.path, "brazil-build", []);
    if (!buildResult.ok) {
      console.log();
      console.log(c.err(`  Build failed for ${pkg.name}:`));
      separator();
      console.log();
      const lines = buildResult.output.split(`
`);
      const tail = lines.slice(-60);
      for (const line of tail) {
        console.log(line);
      }
      process.exit(1);
    }
  }
  console.log();
  const env = { STAGE: stageName, AWS_REGION: options.region };
  let anyFailed = false;
  const allFailedFilters = [];
  for (const pkg of targets) {
    const info = detect(pkg);
    const cmd = info.integTestCommand;
    if (!cmd) {
      console.log(`  ${c.pkg(pkg.name)}  ${c.dim("no integration test command")}`);
      continue;
    }
    const envDisplay = `STAGE=${stageName} AWS_REGION=${options.region}`;
    console.log(`  ${c.pkg(pkg.name)}`);
    console.log(c.dim(`  ${envDisplay} ${cmd}`));
    if (info.system === "gradle") {
      const logFile = makeLogPath();
      console.log(c.dim(`  log: ${logFile}`));
      separator();
      console.log();
      const result = await runWithProgress(pkg.path, cmd, passthrough, env, logFile);
      printTestResult(result);
      if (!result.ok) {
        anyFailed = true;
        for (const f of result.failures) {
          allFailedFilters.push(toGradleFilter(f.name));
        }
      }
    } else {
      separator();
      console.log();
      const ok = await streamCommand(pkg.path, cmd, passthrough, env);
      console.log();
      console.log(ok ? c.ok("  passed") : c.err("  failed"));
      if (!ok)
        anyFailed = true;
    }
    if (targets.length > 1)
      console.log();
  }
  if (targets.length === 1) {
    saveLastPkg(LAST_INTEG_PKG_CACHE, targets[0]);
  }
  if (allFailedFilters.length > 0) {
    saveFailureCache({
      timestamp: new Date().toISOString(),
      stage: options.stage,
      region: options.region,
      packageName: targets[0].name,
      testFilters: allFailedFilters
    });
    console.log(c.dim(`  retry failures: zhi test -r`));
  } else if (!anyFailed) {
    invalidate(FAILURE_CACHE_KEY);
  }
  if (anyFailed)
    process.exit(1);
}
async function runWithProgress(cwd, command, passthrough, extraEnv, logFile) {
  const startTime = Date.now();
  const logWriter = Bun.file(logFile).writer();
  const parts = command.split(/\s+/);
  const args = [...parts, ...passthrough];
  const proc = Bun.spawn(args, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...extraEnv }
  });
  let passed = 0;
  let failed = 0;
  let testsStarted = false;
  const failures = [];
  let currentFailure = null;
  let inStderrBlock = false;
  function clearProgress() {
    process.stdout.write("\r" + " ".repeat(80) + "\r");
  }
  function writeProgress(p, f) {
    const total = p + f;
    const passStr = c.ok(`${p} passed`);
    const failStr = f > 0 ? `, ${c.err(`${f} failed`)}` : "";
    process.stdout.write(`\r  ${passStr}${failStr} ${c.dim(`(${total} total)`)}${"".padEnd(10)}`);
  }
  function printInline(text) {
    clearProgress();
    console.log(text);
    writeProgress(passed, failed);
  }
  function handleLine(line) {
    logWriter.write(line + `
`);
    const clean = stripAnsi2(line);
    if (!testsStarted && clean.includes(":integTest")) {
      testsStarted = true;
      writeProgress(0, 0);
      return;
    }
    if (!testsStarted) {
      if (clean.includes("brazil-gradle") || clean.includes("Running build command")) {
        process.stdout.write(`\r  ${c.dim("building...")}${"".padEnd(30)}`);
      }
      return;
    }
    if (/\(\)\s+STANDARD_ERROR\s*$/.test(clean)) {
      currentFailure = null;
      inStderrBlock = true;
      return;
    }
    if (/\(\)\s+PASSED\s*$/.test(clean)) {
      passed++;
      currentFailure = null;
      inStderrBlock = false;
      writeProgress(passed, failed);
      return;
    }
    const failMatch = clean.match(/^(.+\(\))\s+FAILED\s*$/);
    if (failMatch) {
      const name = failMatch[1].trim();
      failed++;
      currentFailure = { name, details: [] };
      failures.push(currentFailure);
      inStderrBlock = false;
      printInline(`
  ${c.err("FAIL")}  ${name}`);
      return;
    }
    if (currentFailure && /^\s{4}/.test(clean)) {
      const detail = clean.trimStart();
      currentFailure.details.push(detail);
      if (currentFailure.details.length === 1 || /\.kt:\d+\)$/.test(detail)) {
        printInline(`        ${c.dim(detail)}`);
      }
      return;
    }
    if (inStderrBlock && /^\s{4}/.test(clean)) {
      return;
    }
    if (clean.trim().length > 0 && !/^\s/.test(clean)) {
      currentFailure = null;
      inStderrBlock = false;
    }
  }
  const [, , exitCode] = await Promise.all([
    readLines2(proc.stdout, handleLine),
    readLines2(proc.stderr, handleLine),
    proc.exited
  ]);
  logWriter.end();
  process.stdout.write("\r" + " ".repeat(80) + "\r");
  return {
    ok: exitCode === 0 && failed === 0,
    passed,
    failed,
    failures,
    logFile,
    durationMs: Date.now() - startTime
  };
}
function printTestResult(r) {
  const total = r.passed + r.failed;
  const dur = formatDuration(r.durationMs);
  if (total === 0 && !r.ok) {
    console.log(`  ${c.err("build failed")} ${c.dim(`(${dur})`)}`);
    return;
  }
  if (r.failed === 0 && r.ok) {
    console.log(`  ${c.ok(`${r.passed}/${total} passed`)} ${c.dim(`(${dur})`)}`);
    return;
  }
  console.log();
  console.log(`  ${c.ok(`${r.passed}`)}/${total} passed, ${c.err(`${r.failed} failed`)} ${c.dim(`(${dur})`)}`);
}
var FAILURE_CACHE_KEY = "test-failures";
function saveFailureCache(data) {
  set(FAILURE_CACHE_KEY, data);
}
function loadFailureCache() {
  return get(FAILURE_CACHE_KEY, 24 * 60 * 60 * 1000) ?? null;
}
function toGradleFilter(testName) {
  return testName.replace(/\s*>\s*/g, ".").replace(/\(\)$/, "");
}
async function capturedExec(cwd, command, args) {
  const parts = command.split(/\s+/);
  const proc = Bun.spawn([...parts, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe"
  });
  const chunks = [];
  await Promise.all([
    readLines2(proc.stdout, (line) => chunks.push(line)),
    readLines2(proc.stderr, (line) => chunks.push(line))
  ]);
  const exitCode = await proc.exited;
  return { ok: exitCode === 0, output: chunks.join(`
`) };
}
async function findDirtyTestablePackages(ws) {
  const all = await ws.packages();
  const dirty = [];
  for (const pkg of all) {
    const status2 = await pkg.status();
    if (status2.dirty) {
      const info = detect(pkg);
      if (info.testCommand || info.integTestCommand)
        dirty.push(pkg);
    }
  }
  return dirty;
}
async function streamCommand(cwd, command, passthrough, extraEnv) {
  const parts = command.split(/\s+/);
  const proc = Bun.spawn([...parts, ...passthrough], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env: extraEnv ? { ...process.env, ...extraEnv } : undefined
  });
  return await proc.exited === 0;
}
async function readLines2(stream, onLine) {
  const reader = stream.getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(`
`);
    buffer = lines.pop();
    for (const line of lines) {
      onLine(line);
    }
  }
  if (buffer.length > 0) {
    onLine(buffer);
  }
}
function makeLogPath() {
  const ts = new Date().toISOString().replace(/[T:]/g, "-").slice(0, 19);
  return `/tmp/zh-integ-${ts}.log`;
}
function stripAnsi2(s) {
  return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}
var LAST_UNIT_PKG_CACHE = "test-last-unit-pkg";
var LAST_INTEG_PKG_CACHE = "test-last-integ-pkg";
async function selectWithDefault(packages, cacheKey) {
  const names = packages.map((p) => p.name);
  const lastPkg = get(cacheKey);
  if (lastPkg && names.includes(lastPkg)) {
    const useDefault = await confirmWithTimeout(`  ${c.pkg(lastPkg)}?`, 5);
    if (useDefault) {
      return packages.find((p) => p.name === lastPkg);
    }
  }
  const selected = await fzfSelect(names);
  return packages.find((p) => p.name === selected);
}
function saveLastPkg(cacheKey, pkg) {
  set(cacheKey, pkg.name);
}
function getPassthroughArgs() {
  const idx = process.argv.indexOf("--");
  if (idx === -1)
    return [];
  return process.argv.slice(idx + 1);
}
function printRunSummary(results) {
  console.log();
  separator();
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) {
    const status2 = r.ok ? c.ok("passed") : c.err("FAILED");
    console.log(`  ${c.pkg(r.pkg.name)}  ${status2}`);
  }
  console.log();
  if (failed > 0) {
    console.log(c.err(`  ${failed} failed, ${passed} passed`));
  } else {
    console.log(c.ok(`  ${passed}/${results.length} passed`));
  }
}

// src/commands/deploy.ts
function registerDeployCommand(program2) {
  program2.command("deploy").argument("[target]", "Stack name[@stage] (fuzzy match)").description("Deploy CDK stacks").option("--redo", "Repeat last deployment (no prompts)").option("--diff", "Show CDK diff before deploying").option("--hotswap", "Lambda-only hotswap deploy (Devo only)").option("--history", "Show deployment log").option("--override", "Override stage guardrails").action(async (target, options) => {
    const ws = Workspace.discover();
    if (!ws) {
      console.error(c.err("No workspace found (no packageInfo in parent dirs)"));
      process.exit(1);
    }
    if (options.history) {
      showHistory();
      return;
    }
    const cdkPkg = await ws.findCdkPackage();
    if (!cdkPkg) {
      console.error(c.err("No CDK package found in workspace"));
      process.exit(1);
    }
    let stackName;
    let stageName;
    if (options.redo) {
      const last = getLastDeploy();
      if (!last) {
        console.error(c.err("No previous deploys. Use zh deploy <target>"));
        process.exit(1);
      }
      stackName = last.stack;
      stageName = last.stage;
      console.log(`  ${c.dim("redo")} ${c.bold(stackName)}`);
    } else if (target) {
      const parsed = parseTarget(target);
      stageName = parsed.stage ?? DEFAULT_STAGE;
      const resolved = resolveStack(parsed.query, stageName);
      stackName = resolved;
    } else {
      const last = getLastDeploy();
      if (last) {
        await showLastDeployInfo(ws, last);
        const yes = await confirm("  Redeploy?");
        if (!yes)
          return;
        stackName = last.stack;
        stageName = last.stage;
      } else {
        console.log(c.dim(`  No previous deploys. Select a stack:
`));
        const stacks = allStacks(DEFAULT_STAGE);
        const selected = await fzfSelect(stacks);
        stackName = selected;
        stageName = DEFAULT_STAGE;
      }
    }
    const stageConfig = getStage(stageName);
    if (!stageConfig) {
      console.error(c.err(`Unknown stage '${stageName}'`));
      process.exit(1);
    }
    const blocked = await enforceGuardrails(stageName, stageConfig, stackName, options);
    if (blocked)
      return;
    console.log(`  ${c.dim("deploy")} ${c.bold(stackName)} ${c.dim("->")} ${stageDisplayName(stageName)} ${c.dim(`(${stageConfig.account})`)}`);
    const creds = await ensureCredentials(stageConfig.account);
    if (!creds.valid) {
      const proceed = await confirm("  Credentials invalid. Continue anyway?");
      if (!proceed)
        return;
    }
    console.log();
    const startTime = Date.now();
    if (options.diff) {
      console.log(c.dim(`  cdk diff ${stackName}`));
      separator();
      console.log();
      await exec(["brazil-build", "cdk", "diff", stackName], cdkPkg.path);
      console.log();
      const proceed = await confirm("  Deploy?");
      if (!proceed)
        return;
      console.log();
    }
    const deployArgs = ["brazil-build", "cdk", "deploy", stackName];
    if (options.hotswap) {
      deployArgs.push("--hotswap");
    }
    const stageGuardrail = getStage(stageName)?.confirmLevel ?? "none";
    if (stageGuardrail === "none" || options.hotswap) {
      deployArgs.push("--require-approval", "never");
    }
    console.log(c.dim(`  deploying ${stackName}...`));
    separator();
    console.log();
    const ok = await exec(deployArgs, cdkPkg.path);
    const durationMs = Date.now() - startTime;
    console.log();
    if (ok) {
      console.log(`  ${c.ok("deployed")} ${c.bold(stackName)} ${c.dim(`(${formatDuration(durationMs)})`)}`);
    } else {
      console.log(`  ${c.err("deploy failed")} ${c.dim(`(${formatDuration(durationMs)})`)}`);
    }
    if (ok) {
      const shas = await getPackageShas(ws);
      recordDeploy({
        stack: stackName,
        stage: stageName,
        timestamp: new Date().toISOString(),
        durationMs,
        hotswap: options.hotswap ?? false,
        shas
      });
    }
    if (ok) {
      const stg = getStage(stageName);
      if (stg) {
        console.log();
        console.log(c.dim(`  tail logs:   zh logs ${stg.logGroup}`));
        console.log(c.dim(`  run integ:   zhi test`));
      }
    }
    if (!ok)
      process.exit(1);
  });
}
function resolveStack(query, stage) {
  const matches = matchStack(query);
  if (matches.length === 0) {
    console.error(c.err(`No stack matching '${query}'`));
    console.log(c.dim(`  Known stacks: Service, FoundationalResources, BuilderToolbox`));
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(c.err(`Ambiguous match '${query}': ${matches.join(", ")}`));
    process.exit(1);
  }
  return fullStackName(matches[0], stage);
}
async function enforceGuardrails(stageName, config, stackName, options) {
  if (options.override)
    return false;
  switch (config.confirmLevel) {
    case "none":
      return false;
    case "prompt": {
      console.log();
      console.log(c.warn(`  !! ${stageDisplayName(stageName).toUpperCase()} deploy (${config.account})`));
      console.log(c.dim("  This is a shared pre-production environment."));
      console.log();
      const yes = await confirm(`  Deploy to ${stageDisplayName(stageName)}?`);
      if (!yes) {
        empty("  Cancelled.");
        return true;
      }
      console.log();
      return false;
    }
    case "type-name": {
      console.log();
      console.log(c.err(`  !! ${stageDisplayName(stageName).toUpperCase()} deploy (${config.account})`));
      console.log(c.warn("  This is a pre-production environment with customer-facing impact."));
      console.log();
      const answer = await prompt(`  Type "${stageDisplayName(stageName)}" to confirm: `);
      if (answer !== stageDisplayName(stageName)) {
        empty("  Cancelled.");
        return true;
      }
      console.log();
      return false;
    }
    case "refuse": {
      console.log();
      console.log(c.err("  Prod deploys go through the pipeline."));
      console.log(c.dim(`  Pipeline: ${PIPELINE_URL}`));
      console.log();
      console.log(c.dim(`  Override: zh deploy ${stackName}@prod --override`));
      return true;
    }
  }
}
async function showLastDeployInfo(ws, last) {
  console.log(`  ${c.dim("last deploy:")} ${c.bold(last.stack)} ${c.dim(`(${formatRelativeTime(last.timestamp)})`)}`);
  try {
    const changed = await getChangedPackages(ws, last.shas);
    if (changed.length > 0) {
      const display = changed.slice(0, 5).map((n) => c.pkg(n)).join(", ");
      const suffix = changed.length > 5 ? c.dim(` +${changed.length - 5} more`) : "";
      console.log(`  ${c.dim("changed:")}    ${display}${suffix}`);
    } else {
      console.log(`  ${c.dim("changed:")}    ${c.dim("none")}`);
    }
  } catch {}
  console.log();
}
function showHistory() {
  const history = getHistory();
  if (history.length === 0) {
    empty("No deploy history.");
    return;
  }
  header("Deploy History");
  separator();
  const rows = history.slice(0, 15).map((r) => {
    const time = formatRelativeTime(r.timestamp);
    const shortStack = r.stack.replace(/^ArccApp-\w+-\d+-/, "");
    const stage = stageDisplayName(r.stage);
    const duration = formatDuration(r.durationMs);
    const hotswap = r.hotswap ? c.dim(" (hotswap)") : "";
    return [c.dim(time), `${shortStack}${c.dim("@")}${stage}`, c.dim(duration) + hotswap];
  });
  table(rows);
}
async function exec(args, cwd) {
  const proc = Bun.spawn(args, {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

// src/cli.ts
var program2 = new Command;
program2.name("zh").description("Personal workspace CLI").version("0.1.0").enablePositionalOptions();
registerStatusCommand(program2);
registerLsCommand(program2);
registerEachCommand(program2);
registerCleanCommand(program2);
registerRebaseCommand(program2);
registerPrepCommand(program2);
registerPruneCommand(program2);
registerBuildCommand(program2);
registerTestCommand(program2);
registerDeployCommand(program2);
program2.command("_root", { hidden: true }).action(() => {
  const ws = Workspace.discover();
  if (ws)
    console.log(ws.root);
});
registerNavCommand(program2);
program2.parse();
