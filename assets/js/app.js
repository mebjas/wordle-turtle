//#region globals
var WIDTH_PER_WORDLE = 200;
var WORDLE_UI_MARGIN = 10;
var WIDTH_PER_WORDLE_ERROR = 20;
var WORDLE_CONTAINER_PADDING_TOP = 5;
var CHAR_BOX_WIDTH = 28;
var CHAR_FONT_SIZE = 20;
var CHAR_BOX_MARGIN = 1;
var CHAR_BOX_BORDER = 1;
//#endregion
//#region dataset manager
var WordleDatasetManager = /** @class */ (function () {
    function WordleDatasetManager() {
        console.assert(typeof WordleDataset !== "undefined");
        this.list = Object.keys(WordleDataset);
        console.log("Loaded " + this.list.length + " entries to dataset.");
    }
    WordleDatasetManager.prototype.getRandomWord = function () {
        var id = Math.floor(Math.random() * this.list.length);
        id %= this.list.length;
        return this.list[id];
    };
    WordleDatasetManager.prototype.isValid = function (word) {
        return typeof WordleDataset[word] !== "undefined";
    };
    return WordleDatasetManager;
}());
//#endregion
//#region Server
var WordleResponseCategory;
(function (WordleResponseCategory) {
    WordleResponseCategory[WordleResponseCategory["SUCCESS"] = 1] = "SUCCESS";
    WordleResponseCategory[WordleResponseCategory["NOT_YET_SUCCESS"] = 2] = "NOT_YET_SUCCESS";
    WordleResponseCategory[WordleResponseCategory["INCORRECT_LENGTH"] = 3] = "INCORRECT_LENGTH";
    WordleResponseCategory[WordleResponseCategory["INVALID_WORD"] = 4] = "INVALID_WORD";
    WordleResponseCategory[WordleResponseCategory["ENTRY_COUNT_EXCEEDED"] = 5] = "ENTRY_COUNT_EXCEEDED";
})(WordleResponseCategory || (WordleResponseCategory = {}));
var PerLetterResponse;
(function (PerLetterResponse) {
    PerLetterResponse[PerLetterResponse["GREEN"] = 1] = "GREEN";
    PerLetterResponse[PerLetterResponse["YELLOW"] = 2] = "YELLOW";
    PerLetterResponse[PerLetterResponse["BLACK"] = 3] = "BLACK";
})(PerLetterResponse || (PerLetterResponse = {}));
var WordleServerResponse = /** @class */ (function () {
    function WordleServerResponse(category, perLetterResponse, entry) {
        this.category = category;
        this.perLetterResponse = perLetterResponse;
        this.entry = entry;
    }
    WordleServerResponse.createIncorrectLength = function (entry) {
        return new WordleServerResponse(WordleResponseCategory.INCORRECT_LENGTH, [], entry);
    };
    WordleServerResponse.createInvalidEntry = function (entry) {
        return new WordleServerResponse(WordleResponseCategory.INVALID_WORD, [], entry);
    };
    WordleServerResponse.createExceedAttempts = function (entry) {
        return new WordleServerResponse(WordleResponseCategory.ENTRY_COUNT_EXCEEDED, [], entry);
    };
    WordleServerResponse.createSuccess = function (entry) {
        var perLetterResponse = [];
        for (var idx = 0; idx < entry.length; ++idx) {
            perLetterResponse.push(PerLetterResponse.GREEN);
        }
        return new WordleServerResponse(WordleResponseCategory.SUCCESS, perLetterResponse, entry);
    };
    return WordleServerResponse;
}());
var WordleServer = /** @class */ (function () {
    function WordleServer(datasetManager) {
        this.attemptsDone = 0;
        this.datasetManager = datasetManager;
        this.target = datasetManager.getRandomWord();
    }
    WordleServer.prototype.validate = function (entry) {
        entry = entry.trim();
        if (entry.length != WordleServer.allowedWordLength) {
            return WordleServerResponse.createIncorrectLength(entry);
        }
        if (!this.datasetManager.isValid(entry)) {
            return WordleServerResponse.createInvalidEntry(entry);
        }
        if (entry == this.target) {
            return WordleServerResponse.createSuccess(entry);
        }
        this.attemptsDone++;
        if (this.attemptsDone > WordleServer.allowedAttempts) {
            return WordleServerResponse.createExceedAttempts(entry);
        }
        // Match partially.
        var perLetterResponse = [];
        for (var idx = 0; idx < this.target.length; ++idx) {
            if (entry[idx] == this.target[idx]) {
                perLetterResponse.push(PerLetterResponse.GREEN);
            }
            else {
                if (this.searchTarget(entry[idx], this.target)) {
                    perLetterResponse.push(PerLetterResponse.YELLOW);
                }
                else {
                    perLetterResponse.push(PerLetterResponse.BLACK);
                }
            }
        }
        return new WordleServerResponse(WordleResponseCategory.NOT_YET_SUCCESS, perLetterResponse, entry);
    };
    WordleServer.prototype.searchTarget = function (char, target) {
        console.assert(char.length == 1);
        for (var idx = 0; idx < target.length; ++idx) {
            if (target[idx] === char[0]) {
                return true;
            }
        }
        return false;
    };
    WordleServer.allowedAttempts = 6;
    WordleServer.allowedWordLength = 5;
    return WordleServer;
}());
//#endregion
//#region Client
var WordleClient = /** @class */ (function () {
    function WordleClient() {
        console.assert(typeof WordleDataset !== "undefined");
        this.list = Object.keys(WordleDataset);
        console.log("Loaded " + this.list.length + " entries to dataset.");
        this.startingWords = ['arose', 'react', 'adieu', 'later', 'sired',
            'tears', 'alone', 'arise', 'about', 'atone', 'irate', 'snare', 'cream',
            'paint', 'worse', 'sauce', 'anime', 'prowl', 'roast', 'drape', 'media'];
    }
    WordleClient.prototype.recommend = function (code, contains, doesntContain, doesntContainPerPosition) {
        console.assert(code.length == 5);
        var recommendedResults = [];
        for (var i = 0; i < this.list.length; ++i) {
            var word = this.list[i];
            var isAMatchSoFar = true;
            //#region Match for the code
            for (var j = 0; j < code.length; ++j) {
                var code_char = code[j];
                if (code_char === '*') {
                    continue;
                }
                if (code_char !== word[j]) {
                    isAMatchSoFar = false;
                    break;
                }
            }
            if (!isAMatchSoFar) {
                continue;
            }
            //#endregion
            //#region Match for 'contains'
            for (var j = 0; j < contains.length; ++j) {
                var needle = contains[j];
                if (!this.contains(needle, word)) {
                    isAMatchSoFar = false;
                    break;
                }
            }
            if (!isAMatchSoFar) {
                continue;
            }
            //#endregion
            //#region Match for 'doesntContain'
            for (var j = 0; j < doesntContain.length; ++j) {
                var needle = doesntContain[j];
                if (this.contains(needle, word)) {
                    isAMatchSoFar = false;
                    break;
                }
            }
            if (!isAMatchSoFar) {
                continue;
            }
            //#endregion
            //#region Match for 'doesntContainPerPosition'
            console.assert(doesntContainPerPosition.length === code.length);
            for (var j = 0; j < code.length; ++j) {
                for (var k = 0; k < doesntContainPerPosition[j].length; ++k) {
                    var needle = doesntContainPerPosition[j][k];
                    if (word[j] === needle) {
                        isAMatchSoFar = false;
                        break;
                    }
                }
                if (!isAMatchSoFar) {
                    break;
                }
            }
            if (!isAMatchSoFar) {
                continue;
            }
            //#endregion
            recommendedResults.push(word);
        }
        // smarter strategy here?
        console.assert(recommendedResults.length > 0);
        return recommendedResults[0];
    };
    WordleClient.prototype.recommendStartingWord = function () {
        var idx = Math.floor(Math.random() * this.startingWords.length);
        idx %= this.startingWords.length;
        var suggestion = this.startingWords[idx];
        if (!suggestion) {
            console.error("No starting suggestion", idx, this.startingWords.length);
            return this.startingWords[0];
        }
        return suggestion;
    };
    WordleClient.prototype.contains = function (needle, haystack) {
        console.assert(needle.length === 1);
        for (var i = 0; i < haystack.length; ++i) {
            if (needle[0] === haystack[i]) {
                return true;
            }
        }
        return false;
    };
    return WordleClient;
}());
//#endregion
var GameResult;
(function (GameResult) {
    GameResult[GameResult["SUCCESSSS"] = 1] = "SUCCESSSS";
    GameResult[GameResult["FAILURE"] = 2] = "FAILURE";
})(GameResult || (GameResult = {}));
var WordleContainer = /** @class */ (function () {
    function WordleContainer(container, id, datasetManager, wordleClient, onGameFinish) {
        this.boxRegistry = {};
        this.timeout = 1000;
        this.startTimeout = Math.floor(Math.random() * 15) * 100;
        this.container = container;
        this.id = id;
        this.datasetManager = datasetManager;
        this.wordleClient = wordleClient;
        this.onGameFinish = onGameFinish;
    }
    ;
    WordleContainer.prototype.startGame = function () {
        var $this = this;
        this.renderInitialPlayground();
        setTimeout(function () {
            $this.startInternal();
        }, this.startTimeout);
    };
    WordleContainer.prototype.startInternal = function () {
        // Start the game.
        var server = new WordleServer(this.datasetManager);
        var nextEntry = this.wordleClient.recommendStartingWord();
        var doesntContain = [];
        var doesntContainPerPosition = this.initDoesntContainPerPosition();
        this.renderAndPlay(server, nextEntry, doesntContain, doesntContainPerPosition, 0);
    };
    WordleContainer.prototype.initDoesntContainPerPosition = function () {
        var result = [];
        for (var i = 0; i < WordleServer.allowedWordLength; ++i) {
            result.push([]);
        }
        return result;
    };
    WordleContainer.prototype.renderInitialPlayground = function () {
        var charBoxWidth = CHAR_BOX_WIDTH;
        var boxMargin = CHAR_BOX_MARGIN;
        var boxBorder = CHAR_BOX_BORDER;
        var paddingTop = WORDLE_CONTAINER_PADDING_TOP;
        var fontSize = CHAR_FONT_SIZE;
        this.container.style.paddingTop = paddingTop + "px";
        this.container.style.textAlign = "center";
        for (var row = 0; row < WordleServer.allowedAttempts; ++row) {
            var rowContainer = document.createElement("div");
            for (var col = 0; col < WordleServer.allowedWordLength; ++col) {
                var key = row + "_" + col;
                var colContainer = document.createElement("div");
                colContainer.style.display = "inline-block";
                colContainer.style.margin = boxMargin + "px";
                colContainer.style.width = charBoxWidth + "px";
                colContainer.style.height = charBoxWidth + "px";
                colContainer.style.border = boxBorder + "px solid #787c7e";
                colContainer.style.justifyContent = "center";
                colContainer.style.alignItems = "center";
                colContainer.style.verticalAlign = "middle";
                colContainer.style.textTransform = "uppercase";
                colContainer.style.color = "white";
                colContainer.style.fontSize = fontSize + "px";
                colContainer.style.fontWeight = "bold";
                rowContainer.appendChild(colContainer);
                this.boxRegistry[key] = colContainer;
            }
            this.container.appendChild(rowContainer);
        }
    };
    WordleContainer.prototype.cleanupAndRestart = function () {
        var $this = this;
        setTimeout(function () {
            $this.container.innerHTML = "";
            $this.startGame();
        }, 5000 + Math.floor(Math.random() * 5) * 1000);
    };
    WordleContainer.prototype.renderAndPlay = function (server, nextEntry, doesntContain, doesntContainPerPosition, attemptNumber) {
        // Draw an emprt row
        var response = server.validate(nextEntry);
        console.assert(response.category !== WordleResponseCategory.ENTRY_COUNT_EXCEEDED);
        console.assert(response.category !== WordleResponseCategory.INVALID_WORD);
        console.assert(response.category !== WordleResponseCategory.INCORRECT_LENGTH);
        for (var col = 0; col < WordleServer.allowedWordLength; ++col) {
            var key = attemptNumber + "_" + col;
            var box = this.boxRegistry[key];
            this.renderBox(box, nextEntry[col], response.perLetterResponse[col]);
        }
        attemptNumber++;
        if (attemptNumber == WordleServer.allowedAttempts) {
            this.onGameFinish(GameResult.FAILURE, attemptNumber, null);
            this.cleanupAndRestart();
            return;
        }
        if (response.category === WordleResponseCategory.SUCCESS) {
            this.onGameFinish(GameResult.SUCCESSSS, attemptNumber, nextEntry);
            this.cleanupAndRestart();
            return;
        }
        var code = "";
        var contains = [];
        for (var j = 0; j < WordleServer.allowedWordLength; ++j) {
            if (response.perLetterResponse[j] === PerLetterResponse.GREEN) {
                code += nextEntry[j];
            }
            else {
                code += "*";
                if (response.perLetterResponse[j]
                    === PerLetterResponse.YELLOW) {
                    contains.push(nextEntry[j]);
                    this.addIfNotAlreadyExists(nextEntry[j], doesntContainPerPosition[j]);
                }
                else {
                    // Gray or doesn't exist.
                    this.addIfNotAlreadyExists(nextEntry[j], doesntContain);
                }
            }
        }
        nextEntry = this.wordleClient.recommend(code, contains, doesntContain, doesntContainPerPosition);
        if (!nextEntry) {
            console.error("failure case happened, no recommendations", code, contains, doesntContain, doesntContainPerPosition);
            this.onGameFinish(GameResult.FAILURE, attemptNumber, null);
            this.cleanupAndRestart();
            return;
        }
        var $this = this;
        setTimeout(function () {
            $this.renderAndPlay(server, nextEntry, doesntContain, doesntContainPerPosition, attemptNumber);
        }, this.timeout);
    };
    WordleContainer.prototype.addIfNotAlreadyExists = function (needle, haystack) {
        console.assert(needle.length === 1);
        for (var j = 0; j < haystack.length; ++j) {
            if (needle[0] === haystack[j]) {
                return;
            }
        }
        haystack.push(needle);
    };
    WordleContainer.prototype.renderBox = function (box, char, perLetterResponse) {
        box.innerText = char;
        if (perLetterResponse == PerLetterResponse.GREEN) {
            box.style.background = "#6aaa64";
        }
        else if (perLetterResponse == PerLetterResponse.YELLOW) {
            box.style.background = "#c9b458";
        }
        else {
            box.style.background = "#787c7e";
        }
    };
    return WordleContainer;
}());
var App = /** @class */ (function () {
    function App(workspace, operator) {
        this.gameCount = 0;
        this.gameSuccess = 0;
        this.averageTurns = 0;
        this.workspace = workspace;
        this.operator = operator;
        this.rows = 5;
        this.datasetManager = new WordleDatasetManager();
        this.wordleClient = new WordleClient();
    }
    App.prototype.render = function () {
        var _this = this;
        var marginOfError = WIDTH_PER_WORDLE_ERROR;
        var widthPerWordle = WIDTH_PER_WORDLE;
        var wordleUiMargin = WORDLE_UI_MARGIN;
        var offsetWidth = widthPerWordle + 2 * wordleUiMargin;
        var wordlePerRow = Math.floor((this.workspace.offsetWidth - marginOfError) / offsetWidth);
        var padding = (this.workspace.offsetWidth - offsetWidth * wordlePerRow) / 2;
        this.workspace.style.paddingLeft = padding + "px";
        this.workspace.style.paddingTop = "10px";
        this.workspace.style.paddingBottom = "10px";
        var $this = this;
        var callback = function (result, attempts, word) {
            $this.gameCount++;
            if (result == GameResult.SUCCESSSS) {
                $this.averageTurns = (($this.averageTurns * $this.gameSuccess) + attempts) / ($this.gameSuccess + 1);
                $this.gameSuccess++;
                // precision to 2 places
                $this.averageTurns = Math.ceil($this.averageTurns * 100) / 100;
            }
            $this.operator.innerText = "[Stats] success = " + $this.gameSuccess + "/" + $this.gameCount + "; "
                + ("Average attempts = " + _this.averageTurns + "; ");
            if (result == GameResult.SUCCESSSS) {
                $this.operator.innerText += "Last result = " + word;
            }
        };
        for (var y = 0; y < this.rows; ++y) {
            for (var x = 0; x < wordlePerRow; ++x) {
                var id = "c_" + y + "_" + x;
                var wordleContainer = document.createElement("div");
                wordleContainer.setAttribute("container-id", id);
                wordleContainer.style.width = widthPerWordle + "px";
                wordleContainer.style.height = widthPerWordle + "px";
                wordleContainer.style.border = "1px solid #80808087";
                wordleContainer.style.display = "inline-block";
                wordleContainer.style.background = "white";
                wordleContainer.style.margin = wordleUiMargin + "px";
                this.workspace.appendChild(wordleContainer);
                var wc = new WordleContainer(wordleContainer, id, this.datasetManager, this.wordleClient, callback);
                wc.startGame();
            }
        }
    };
    return App;
}());
function docReady(fn) {
    // see if DOM is already available
    if (document.readyState === "complete" || document.readyState === "interactive") {
        // call on next available tick
        setTimeout(fn, 1);
    }
    else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}
docReady(function () {
    var operator = document.getElementById("operators");
    var workspace = document.getElementById("workspace");
    var app = new App(workspace, operator);
    app.render();
});
