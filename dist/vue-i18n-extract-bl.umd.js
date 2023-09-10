(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('cac'), require('fs'), require('path'), require('is-valid-glob'), require('glob'), require('js-yaml'), require('dot-prop-bl')) :
  typeof define === 'function' && define.amd ? define(['exports', 'cac', 'fs', 'path', 'is-valid-glob', 'glob', 'js-yaml', 'dot-prop-bl'], factory) :
  (global = global || self, factory(global.vueI18NExtractBl = {}, global.cac, global.fs, global.path, global.isValidGlob, global.glob, global.jsYaml, global.dotPropBl));
})(this, (function (exports, cac, fs, path, isValidGlob, glob, yaml, dotPropBl) {
  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var cac__default = /*#__PURE__*/_interopDefaultLegacy(cac);
  var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
  var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
  var isValidGlob__default = /*#__PURE__*/_interopDefaultLegacy(isValidGlob);
  var glob__default = /*#__PURE__*/_interopDefaultLegacy(glob);
  var yaml__default = /*#__PURE__*/_interopDefaultLegacy(yaml);

  var defaultConfig = {
    // Options documented in vue-i18n-extract readme.
    vueFiles: './src/**/*.?(js|vue)',
    languageFiles: './lang/**/*.?(json|yaml|yml|js)',
    exclude: [],
    output: false,
    add: false,
    remove: false,
    ci: false,
    noEmptyTranslation: '',
    missingTranslationString: ''
  };

  function initCommand() {
    fs__default["default"].writeFileSync(path__default["default"].resolve(process.cwd(), "./vue-i18n-extract.config.js"), `module.exports = ${JSON.stringify(defaultConfig, null, 2)}`);
  }
  function resolveConfig() {
    const argvOptions = cac__default["default"]().parse(process.argv, {
      run: false
    }).options;
    let options;
    try {
      const pathToConfigFile = path__default["default"].resolve(process.cwd(), "./vue-i18n-extract.config.js");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const configOptions = require(pathToConfigFile);
      console.info(`\nUsing config file found at ${pathToConfigFile}`);
      options = {
        ...configOptions,
        ...argvOptions
      };
    } catch {
      options = argvOptions;
    }
    options.exclude = Array.isArray(options.exclude) ? options.exclude : [options.exclude];
    return options;
  }

  exports.DetectionType = void 0;
  (function (DetectionType) {
    DetectionType["Missing"] = "missing";
    DetectionType["Unused"] = "unused";
    DetectionType["Dynamic"] = "dynamic";
  })(exports.DetectionType || (exports.DetectionType = {}));

  function readVueFiles(src) {
    // Replace backslash path segments to make the path work with the glob package.
    // https://github.com/Spittal/vue-i18n-extract/issues/159
    const normalizedSrc = src.replace(/\\/g, '/');
    if (!isValidGlob__default["default"](normalizedSrc)) {
      throw new Error(`vueFiles isn't a valid glob pattern.`);
    }
    const targetFiles = glob__default["default"].sync(normalizedSrc);
    if (targetFiles.length === 0) {
      throw new Error('vueFiles glob has no files.');
    }
    return targetFiles.map(f => {
      const fileName = f.replace(process.cwd(), '.');
      return {
        fileName,
        path: f,
        content: fs__default["default"].readFileSync(f, 'utf8')
      };
    });
  }
  function* getMatches(file, regExp, captureGroup = 1) {
    while (true) {
      const match = regExp.exec(file.content);
      if (match === null) {
        break;
      }
      const path = match[captureGroup];
      const pathAtIndex = file.content.indexOf(path);
      const previousCharacter = file.content.charAt(pathAtIndex - 1);
      const nextCharacter = file.content.charAt(pathAtIndex + path.length);
      const line = (file.content.substring(0, match.index).match(/\n/g) || []).length + 1;
      yield {
        path,
        previousCharacter,
        nextCharacter,
        file: file.fileName,
        line
      };
    }
  }
  /**
   * Extracts translation keys from methods such as `$t` and `$tc`.
   *
   * - **regexp pattern**: (?:[$\s.:"'`+\(\[\{]t[cm]?)\(
   *
   *   **description**: Matches the sequence t(, tc( or tm(, optionally with either “$”, SPACE, “.”, “:”, “"”, “'”,
   *   “`”, "+", "(", "[" or "{" in front of it.
   *
   * - **regexp pattern**: (["'`])
   *
   *   **description**: 1. capturing group. Matches either “"”, “'”, or “`”.
   *
   * - **regexp pattern**: ((?:[^\\]|\\.)*?)
   *
   *   **description**: 2. capturing group. Matches anything except a backslash
   *   *or* matches any backslash followed by any character (e.g. “\"”, “\`”, “\t”, etc.)
   *
   * - **regexp pattern**: \1
   *
   *   **description**: matches whatever was matched by capturing group 1 (e.g. the starting string character)
   *
   * @param file a file object
   * @returns a list of translation keys found in `file`.
   */
  function extractMethodMatches(file) {
    const methodRegExp = /(?:[$\s.:"'`+\(\[\{]t[cm]?)\(\s*?(["'`])((?:[^\\]|\\.)*?)\1/g;
    return [...getMatches(file, methodRegExp, 2)];
  }
  function extractComponentMatches(file) {
    const componentRegExp = /(?:(?:<|h\()(?:i18n|Translation))(?:.|\n)*?(?:\s(?:(?:key)?)path(?:=|: )("|'))((?:[^\\]|\\.)*?)\1/gi;
    return [...getMatches(file, componentRegExp, 2)];
  }
  function extractDirectiveMatches(file) {
    const directiveRegExp = /\bv-t(?:\.[\w-]+)?="'((?:[^\\]|\\.)*?)'"/g;
    return [...getMatches(file, directiveRegExp)];
  }
  function extractI18NItemsFromVueFiles(sourceFiles) {
    return sourceFiles.reduce((accumulator, file) => {
      const methodMatches = extractMethodMatches(file);
      const componentMatches = extractComponentMatches(file);
      const directiveMatches = extractDirectiveMatches(file);
      return [...accumulator, ...methodMatches, ...componentMatches, ...directiveMatches];
    }, []);
  }
  // This is a convenience function for users implementing in their own projects, and isn't used internally
  function parseVueFiles(vueFiles) {
    return extractI18NItemsFromVueFiles(readVueFiles(vueFiles));
  }

  function readLanguageFiles(src) {
    // Replace backslash path segments to make the path work with the glob package.
    // https://github.com/Spittal/vue-i18n-extract/issues/159
    const normalizedSrc = src.replace(/\\/g, "/");
    if (!isValidGlob__default["default"](normalizedSrc)) {
      throw new Error(`languageFiles isn't a valid glob pattern.`);
    }
    const targetFiles = glob__default["default"].sync(normalizedSrc);
    if (targetFiles.length === 0) {
      throw new Error("languageFiles glob has no files.");
    }
    return targetFiles.map(f => {
      const langPath = path__default["default"].resolve(process.cwd(), f);
      const extension = langPath.substring(langPath.lastIndexOf(".")).toLowerCase();
      const isJSON = extension === ".json";
      const isYAML = extension === ".yaml" || extension === ".yml";
      let langObj;
      if (isJSON) {
        langObj = JSON.parse(fs__default["default"].readFileSync(langPath, "utf8"));
      } else if (isYAML) {
        langObj = yaml__default["default"].load(fs__default["default"].readFileSync(langPath, "utf8"));
      } else {
        langObj = eval(fs__default["default"].readFileSync(langPath, "utf8"));
      }
      const fileName = f.replace(process.cwd(), ".");
      return {
        path: f,
        fileName,
        content: JSON.stringify(langObj)
      };
    });
  }
  function extractI18NLanguageFromLanguageFiles(languageFiles) {
    return languageFiles.reduce((accumulator, file) => {
      const language = file.fileName.substring(file.fileName.lastIndexOf("/") + 1, file.fileName.lastIndexOf("."));
      if (!accumulator[language]) {
        accumulator[language] = [];
      }
      const paths = dotPropBl.deepKeys(JSON.parse(file.content));
      paths.forEach(path => {
        accumulator[language].push({
          path,
          file: file.fileName
        });
      });
      return accumulator;
    }, {});
  }
  function writeMissingToLanguageFiles(parsedLanguageFiles, missingKeys, noEmptyTranslation = "", missingTranslationString = "") {
    parsedLanguageFiles.forEach(languageFile => {
      const languageFileContent = JSON.parse(languageFile.content);
      missingKeys.forEach(item => {
        if (item.language && languageFile.fileName.includes(item.language) || !item.language) {
          const addDefaultTranslation = noEmptyTranslation && (noEmptyTranslation === "*" || noEmptyTranslation === item.language);
          dotPropBl.setProperty(languageFileContent, item.path, addDefaultTranslation ? item.path : missingTranslationString === "null" ? null : missingTranslationString);
        }
      });
      languageFile.content = JSON.stringify(languageFileContent);
      writeLanguageFile(languageFile, languageFileContent);
    });
  }
  function removeUnusedFromLanguageFiles(parsedLanguageFiles, unusedKeys) {
    parsedLanguageFiles.forEach(languageFile => {
      const languageFileContent = JSON.parse(languageFile.content);
      unusedKeys.forEach(item => {
        if (item.language && languageFile.fileName.includes(item.language)) {
          dotPropBl.deleteProperty(languageFileContent, item.path);
        }
      });
      languageFile.content = JSON.stringify(languageFileContent);
      writeLanguageFile(languageFile, languageFileContent);
    });
  }
  function writeLanguageFile(languageFile, newLanguageFileContent) {
    const fileExtension = languageFile.fileName.substring(languageFile.fileName.lastIndexOf(".") + 1);
    const filePath = languageFile.path;
    const stringifiedContent = JSON.stringify(newLanguageFileContent, null, 2);
    if (fileExtension === "json") {
      fs__default["default"].writeFileSync(filePath, stringifiedContent);
    } else if (fileExtension === "js") {
      const jsFile = `module.exports = ${stringifiedContent}; \n`;
      fs__default["default"].writeFileSync(filePath, jsFile);
    } else if (fileExtension === "yaml" || fileExtension === "yml") {
      const yamlFile = yaml__default["default"].dump(newLanguageFileContent);
      fs__default["default"].writeFileSync(filePath, yamlFile);
    } else {
      throw new Error(`Language filetype of ${fileExtension} not supported.`);
    }
  }
  // This is a convenience function for users implementing in their own projects, and isn't used internally
  function parselanguageFiles(languageFiles) {
    return extractI18NLanguageFromLanguageFiles(readLanguageFiles(languageFiles));
  }

  function stripBounding(item) {
    return {
      path: item.path,
      file: item.file,
      line: item.line
    };
  }
  function mightBeDynamic(item) {
    return item.path.includes('${') && !!item.previousCharacter.match(/`/g) && !!item.nextCharacter.match(/`/g);
  }
  // Looping through the arays multiple times might not be the most effecient, but it's the easiest to read and debug. Which at this scale is an accepted trade-off.
  function extractI18NReport(vueItems, languageFiles, detect) {
    const missingKeys = [];
    const unusedKeys = [];
    const maybeDynamicKeys = [];
    if (detect.includes(exports.DetectionType.Dynamic)) {
      maybeDynamicKeys.push(...vueItems.filter(vueItem => mightBeDynamic(vueItem)).map(vueItem => stripBounding(vueItem)));
    }
    Object.keys(languageFiles).forEach(language => {
      const languageItems = languageFiles[language];
      if (detect.includes(exports.DetectionType.Missing)) {
        const missingKeysInLanguage = vueItems.filter(vueItem => !mightBeDynamic(vueItem)).filter(vueItem => !languageItems.some(languageItem => vueItem.path === languageItem.path)).map(vueItem => ({
          ...stripBounding(vueItem),
          language
        }));
        missingKeys.push(...missingKeysInLanguage);
      }
      if (detect.includes(exports.DetectionType.Unused)) {
        const unusedKeysInLanguage = languageItems.filter(languageItem => !vueItems.some(vueItem => languageItem.path === vueItem.path || languageItem.path.startsWith(vueItem.path + '.'))).map(languageItem => ({
          ...languageItem,
          language
        }));
        unusedKeys.push(...unusedKeysInLanguage);
      }
    });
    return {
      missingKeys,
      unusedKeys,
      maybeDynamicKeys
    };
  }
  async function writeReportToFile(report, writePath) {
    const reportString = JSON.stringify(report);
    return new Promise((resolve, reject) => {
      fs__default["default"].writeFile(writePath, reportString, err => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async function createI18NReport(options) {
    const {
      vueFiles: vueFilesGlob,
      languageFiles: languageFilesGlob,
      output,
      add,
      remove,
      exclude = [],
      ci,
      noEmptyTranslation = "",
      missingTranslationString = "",
      detect = [exports.DetectionType.Missing, exports.DetectionType.Unused, exports.DetectionType.Dynamic]
    } = options;
    if (!vueFilesGlob) throw new Error("Required configuration vueFiles is missing.");
    if (!languageFilesGlob) throw new Error("Required configuration languageFiles is missing.");
    const issuesToDetect = Array.isArray(detect) ? detect : [detect];
    const invalidDetectOptions = issuesToDetect.filter(item => !Object.values(exports.DetectionType).includes(item));
    if (invalidDetectOptions.length) {
      throw new Error(`Invalid 'detect' value(s): ${invalidDetectOptions}`);
    }
    const vueFiles = readVueFiles(path__default["default"].resolve(process.cwd(), vueFilesGlob));
    const languageFiles = readLanguageFiles(path__default["default"].resolve(process.cwd(), languageFilesGlob));
    const I18NItems = extractI18NItemsFromVueFiles(vueFiles);
    const I18NLanguage = extractI18NLanguageFromLanguageFiles(languageFiles);
    const report = extractI18NReport(I18NItems, I18NLanguage, issuesToDetect);
    report.unusedKeys = report.unusedKeys.filter(key => !exclude.filter(excluded => key.path.startsWith(excluded)).length);
    if (report.missingKeys.length) console.info("\nMissing Keys"), console.table(report.missingKeys);
    if (report.unusedKeys.length) console.info("\nUnused Keys"), console.table(report.unusedKeys);
    if (report.maybeDynamicKeys.length) console.warn("\nSuspected Dynamic Keys Found\nvue-i18n-extract does not compile Vue templates and therefore can not infer the correct key for the following keys."), console.table(report.maybeDynamicKeys);
    if (output) {
      await writeReportToFile(report, path__default["default"].resolve(process.cwd(), output));
      console.info(`\nThe report has been has been saved to ${output}`);
    }
    if (remove && report.unusedKeys.length) {
      removeUnusedFromLanguageFiles(languageFiles, report.unusedKeys);
      console.info("\nThe unused keys have been removed from your language files.");
    }
    if (add && report.missingKeys.length) {
      writeMissingToLanguageFiles(languageFiles, report.missingKeys, noEmptyTranslation, missingTranslationString);
      console.info("\nThe missing keys have been added to your language files.");
    }
    if (ci && report.missingKeys.length) {
      throw new Error(`${report.missingKeys.length} missing keys found.`);
    }
    if (ci && report.unusedKeys.length) {
      throw new Error(`${report.unusedKeys.length} unused keys found.`);
    }
    return report;
  }

  process.on('uncaughtException', err => {
    console.error('[vue-i18n-extract]', err);
    process.exit(1);
  });
  process.on('unhandledRejection', err => {
    console.error('[vue-i18n-extract]', err);
    process.exit(1);
  });

  exports.createI18NReport = createI18NReport;
  exports.extractI18NItemsFromVueFiles = extractI18NItemsFromVueFiles;
  exports.extractI18NLanguageFromLanguageFiles = extractI18NLanguageFromLanguageFiles;
  exports.extractI18NReport = extractI18NReport;
  exports.initCommand = initCommand;
  exports.parseVueFiles = parseVueFiles;
  exports.parselanguageFiles = parselanguageFiles;
  exports.readLanguageFiles = readLanguageFiles;
  exports.readVueFiles = readVueFiles;
  exports.removeUnusedFromLanguageFiles = removeUnusedFromLanguageFiles;
  exports.resolveConfig = resolveConfig;
  exports.writeMissingToLanguageFiles = writeMissingToLanguageFiles;
  exports.writeReportToFile = writeReportToFile;

}));
//# sourceMappingURL=vue-i18n-extract-bl.umd.js.map
