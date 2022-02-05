//#region globals
let WIDTH_PER_WORDLE = 200;
let WORDLE_UI_MARGIN = 10;
let WIDTH_PER_WORDLE_ERROR = 20;
let WORDLE_CONTAINER_PADDING_TOP = 5;
let CHAR_BOX_WIDTH = 28;
let CHAR_FONT_SIZE = 20;
let CHAR_BOX_MARGIN = 1;
let CHAR_BOX_BORDER = 1;
//#endregion

//#region dataset manager
class WordleDatasetManager {
    private list: Array<string>;
 
    constructor() {
        console.assert(typeof WordleDataset !== "undefined");
        this.list = Object.keys(WordleDataset);
        console.log(`Loaded ${this.list.length} entries to dataset.`);
    }

    public getRandomWord(): string {
        let id = Math.floor(Math.random() * this.list.length);
        id %= this.list.length;
        return this.list[id];
    }

    public isValid(word: string): boolean {
        return typeof WordleDataset[word] !== "undefined";
    }
}
//#endregion

//#region Server
enum WordleResponseCategory {
    SUCCESS = 1,
    NOT_YET_SUCCESS = 2,
    INCORRECT_LENGTH = 3,
    INVALID_WORD = 4,
    ENTRY_COUNT_EXCEEDED = 5,
}

enum PerLetterResponse {
    GREEN = 1,
    YELLOW = 2,
    BLACK = 3,
}

class WordleServerResponse {
    public readonly category: WordleResponseCategory;
    public readonly perLetterResponse: Array<PerLetterResponse>;
    public readonly entry: string;
    
    constructor(
        category: WordleResponseCategory,
        perLetterResponse: Array<PerLetterResponse>,
        entry: string) {
        this.category = category;
        this.perLetterResponse = perLetterResponse;
        this.entry = entry;
    }

    public static createIncorrectLength(entry: string): WordleServerResponse {
        return new WordleServerResponse(
            WordleResponseCategory.INCORRECT_LENGTH,
            [],
            entry);
    }

    public static createInvalidEntry(entry: string): WordleServerResponse {
        return new WordleServerResponse(
            WordleResponseCategory.INVALID_WORD,
            [],
            entry);
    }

    public static createExceedAttempts(entry: string): WordleServerResponse {
        return new WordleServerResponse(
            WordleResponseCategory.ENTRY_COUNT_EXCEEDED,
            [],
            entry);
    }

    public static createSuccess(entry: string): WordleServerResponse {
        let perLetterResponse = [];
        for (let idx = 0; idx < entry.length; ++idx) {
            perLetterResponse.push(PerLetterResponse.GREEN);
        }
        return new WordleServerResponse(
            WordleResponseCategory.SUCCESS,
            perLetterResponse,
            entry);
    }
}

class WordleServer {
    private datasetManager: WordleDatasetManager;
    private target: string;
    private attemptsDone = 0;

    public static readonly allowedAttempts = 6;
    public static readonly allowedWordLength = 5;

    constructor(datasetManager: WordleDatasetManager) {
        this.datasetManager = datasetManager;

        this.target = datasetManager.getRandomWord();
    }

    public validate(entry: string): WordleServerResponse {
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
        let perLetterResponse = [];
        for (let idx = 0; idx < this.target.length; ++idx) {
            if (entry[idx] == this.target[idx]) {
                perLetterResponse.push(PerLetterResponse.GREEN);
            } else {
                if (this.searchTarget(entry[idx], this.target)) {
                    perLetterResponse.push(PerLetterResponse.YELLOW);
                } else {
                    perLetterResponse.push(PerLetterResponse.BLACK);
                }
            }
        }

        return new WordleServerResponse(
            WordleResponseCategory.NOT_YET_SUCCESS,
            perLetterResponse,
            entry);
    }

    private searchTarget(char: string, target: string) {
        console.assert(char.length == 1);
        for (let idx = 0; idx < target.length; ++idx) {
            if (target[idx] === char[0]) {
                return true;
            }
        }
        return false;
    }
}
//#endregion

//#region Client
class WordleClient {
    private list: Array<string>;
    private startingWords: Array<string>;

    constructor() {
        console.assert(typeof WordleDataset !== "undefined");
        this.list = Object.keys(WordleDataset);
        console.log(`Loaded ${this.list.length} entries to dataset.`);

        this.startingWords = ['arose', 'react', 'adieu', 'later', 'sired', 
            'tears', 'alone', 'arise', 'about', 'atone', 'irate', 'snare', 'cream',
            'paint', 'worse', 'sauce', 'anime', 'prowl', 'roast', 'drape', 'media'];
    }

    public recommend(
        code: string,
        contains: Array<string>,
        doesntContain: Array<string>,
        doesntContainPerPosition: Array<Array<string>>): string {
        console.assert(code.length == 5);
        let recommendedResults = [];
        for (let i = 0; i < this.list.length; ++i) {
            let word = this.list[i];
            let isAMatchSoFar = true;

            //#region Match for the code
            for (let j = 0; j < code.length; ++j) {
                let code_char = code[j];
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
            for (let j = 0; j < contains.length; ++j) {
                let needle = contains[j];
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
            for (let j = 0; j < doesntContain.length; ++j) {
                let needle = doesntContain[j];
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
            for (let j = 0; j < code.length; ++j) {
                for (let k = 0; k < doesntContainPerPosition[j].length; ++k) {
                    let needle = doesntContainPerPosition[j][k];
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
    }

    public recommendStartingWord(): string {
        let idx = Math.floor(Math.random() * this.startingWords.length);
        idx %= this.startingWords.length;
        let suggestion = this.startingWords[idx];
        if (!suggestion) {
            console.error("No starting suggestion", idx, this.startingWords.length);
            return this.startingWords[0];
        }
        return suggestion;
    }

    private contains(needle: string, haystack: string): boolean {
        console.assert(needle.length === 1);
        for (let i = 0; i < haystack.length; ++i) {
            if (needle[0] === haystack[i]) {
                return true;
            }
        }
        return false;
    }
}
//#endregion

enum GameResult {
    SUCCESSSS = 1,
    FAILURE = 2
}

type GameFinishCallback = (result: GameResult, attempts: number, word: string | null) => void;

class WordleContainer {
    private container: HTMLDivElement;
    private id: string;
    private datasetManager: WordleDatasetManager;
    private wordleClient: WordleClient;
    private onGameFinish: GameFinishCallback;;

    private boxRegistry : { [key: string]: HTMLDivElement } = {};

    private readonly timeout = 1000;
    private readonly startTimeout = Math.floor(Math.random() * 15) * 100;

    constructor(
        container: HTMLDivElement,
        id: string,
        datasetManager: WordleDatasetManager,
        wordleClient: WordleClient,
        onGameFinish: GameFinishCallback) {
        this.container = container;
        this.id = id;
        this.datasetManager = datasetManager;
        this.wordleClient = wordleClient;
        this.onGameFinish = onGameFinish;
    }

    public startGame() {
        let $this = this;
        this.renderInitialPlayground();

        setTimeout(() => {
            $this.startInternal();
        }, this.startTimeout);
    }

    private startInternal() {

        // Start the game.
        let server = new WordleServer(this.datasetManager); 
        let nextEntry = this.wordleClient.recommendStartingWord();
        let doesntContain = [];
        let doesntContainPerPosition = this.initDoesntContainPerPosition();
        this.renderAndPlay(
            server, nextEntry, doesntContain, doesntContainPerPosition, 0);
    }

    private initDoesntContainPerPosition(): Array<Array<string>> {
        let result: Array<Array<string>> = [];
        for (let i = 0; i < WordleServer.allowedWordLength; ++i) {
            result.push([]);
        }
        return result;
    }

    private renderInitialPlayground() {
        let charBoxWidth = CHAR_BOX_WIDTH;
        let boxMargin = CHAR_BOX_MARGIN;
        let boxBorder = CHAR_BOX_BORDER;
        let paddingTop = WORDLE_CONTAINER_PADDING_TOP;
        let fontSize = CHAR_FONT_SIZE;
        this.container.style.paddingTop = `${paddingTop}px`;
        this.container.style.textAlign = "center";

        for (let row = 0; row < WordleServer.allowedAttempts; ++row) {
            let rowContainer = document.createElement("div");
            for (let col = 0; col < WordleServer.allowedWordLength; ++col) {
                let key = `${row}_${col}`
                let colContainer = document.createElement("div");
                colContainer.style.display = "inline-block";
                colContainer.style.margin = `${boxMargin}px`;
                colContainer.style.width = `${charBoxWidth}px`;
                colContainer.style.height = `${charBoxWidth}px`;
                colContainer.style.border = `${boxBorder}px solid #787c7e`;
                colContainer.style.justifyContent = "center";
                colContainer.style.alignItems = "center";
                colContainer.style.verticalAlign = "middle";
                colContainer.style.textTransform = "uppercase";
                colContainer.style.color = "white";
                colContainer.style.fontSize = `${fontSize}px`;
                colContainer.style.fontWeight = "bold";
                rowContainer.appendChild(colContainer);

                this.boxRegistry[key] = colContainer;
            }
            this.container.appendChild(rowContainer);
        }
    }

    private cleanupAndRestart() {
        let $this = this;
        setTimeout(() => {
            $this.container.innerHTML = "";
            $this.startGame();
        }, 5000 + Math.floor(Math.random() * 5) * 1000);
    }

    private renderAndPlay(
        server: WordleServer,
        nextEntry: string,
        doesntContain: Array<string>,
        doesntContainPerPosition: Array<Array<string>>,
        attemptNumber: number) {
        // Draw an emprt row
        let response = server.validate(nextEntry);
        console.assert(response.category !== WordleResponseCategory.ENTRY_COUNT_EXCEEDED);
        console.assert(response.category !== WordleResponseCategory.INVALID_WORD);
        console.assert(response.category !== WordleResponseCategory.INCORRECT_LENGTH);

        for (let col = 0; col < WordleServer.allowedWordLength; ++col) {
            let key = `${attemptNumber}_${col}`;
            let box = this.boxRegistry[key];
            this.renderBox(
                box, nextEntry[col], response.perLetterResponse[col]);
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

        let code = "";
        let contains = [];
        for (let j = 0; j < WordleServer.allowedWordLength; ++j) {
            if (response.perLetterResponse[j] === PerLetterResponse.GREEN) {
                code += nextEntry[j];
            } else {
                code += "*";
                if (response.perLetterResponse[j]
                    === PerLetterResponse.YELLOW) {
                    contains.push(nextEntry[j]);
                    this.addIfNotAlreadyExists(
                        nextEntry[j], doesntContainPerPosition[j]);
                } else {
                    // Gray or doesn't exist.
                    this.addIfNotAlreadyExists(nextEntry[j], doesntContain);
                }
            }
        }

        nextEntry = this.wordleClient.recommend(
            code,
            contains,
            doesntContain,
            doesntContainPerPosition);
        if (!nextEntry) {
            console.error("failure case happened, no recommendations",
                code, contains, doesntContain, doesntContainPerPosition);
            this.onGameFinish(GameResult.FAILURE, attemptNumber, null);
            this.cleanupAndRestart();
            return;
        }

        let $this = this;
        setTimeout(() => {
            $this.renderAndPlay(
                server,
                nextEntry,
                doesntContain,
                doesntContainPerPosition,
                attemptNumber);
        }, this.timeout);
    }

    private addIfNotAlreadyExists(needle: string, haystack: Array<string>) {
        console.assert(needle.length === 1);
        for (let j = 0; j < haystack.length; ++j) {
            if (needle[0] === haystack[j]) {
                return;
            }
        }
        haystack.push(needle);
    }

    private renderBox(
        box: HTMLDivElement,
        char: string,
        perLetterResponse: PerLetterResponse) {
        box.innerText = char;
        if (perLetterResponse == PerLetterResponse.GREEN) {
            box.style.background = "#6aaa64";
        } else if (perLetterResponse == PerLetterResponse.YELLOW) {
            box.style.background = "#c9b458";
        } else {
            box.style.background = "#787c7e";
        }
    }
}

class App {
    private workspace: HTMLElement;
    private operator: HTMLElement;
    private rows: number;
    private datasetManager: WordleDatasetManager;
    private wordleClient: WordleClient;

    private gameCount = 0;
    private gameSuccess = 0;
    private averageTurns = 0;

    constructor(workspace: HTMLElement, operator: HTMLElement) {
        this.workspace = workspace;
        this.operator = operator;
        this.rows = 5;

        this.datasetManager = new WordleDatasetManager();
        this.wordleClient = new WordleClient();
    }

    public render() {
        let marginOfError = WIDTH_PER_WORDLE_ERROR;
        let widthPerWordle = WIDTH_PER_WORDLE;
        let wordleUiMargin = WORDLE_UI_MARGIN;
        let offsetWidth = widthPerWordle + 2 * wordleUiMargin;
        let wordlePerRow = Math.floor(
            (this.workspace.offsetWidth - marginOfError) / offsetWidth);
        let padding = (
            this.workspace.offsetWidth - offsetWidth * wordlePerRow) / 2;
        this.workspace.style.paddingLeft = `${padding}px`;
        this.workspace.style.paddingTop = "10px";
        this.workspace.style.paddingBottom = "10px";

        let $this = this;
        let callback = (result: GameResult, attempts: number, word: string | null) => {
            $this.gameCount++;
            if (result == GameResult.SUCCESSSS) {
                $this.averageTurns = (($this.averageTurns * $this.gameSuccess) + attempts) / ($this.gameSuccess + 1);
                $this.gameSuccess++;

                // precision to 2 places
                $this.averageTurns = Math.ceil($this.averageTurns * 100) / 100;
            }

            $this.operator.innerText = `[Stats] success = ${$this.gameSuccess}/${$this.gameCount}; `
                + `Average attempts = ${this.averageTurns}; `;
            if (result == GameResult.SUCCESSSS) {
                $this.operator.innerText += `Last result = ${word}`;
            }
        };

        for (let y = 0; y < this.rows; ++y) {
            for (let x = 0; x < wordlePerRow; ++x) {
                const id = `c_${y}_${x}`;
                let wordleContainer = document.createElement("div");
                wordleContainer.setAttribute("container-id", id);
                wordleContainer.style.width = `${widthPerWordle}px`;
                wordleContainer.style.height = `${widthPerWordle}px`;
                wordleContainer.style.border = "1px solid #80808087";
                wordleContainer.style.display = "inline-block";
                wordleContainer.style.background = "white";
                wordleContainer.style.margin = `${wordleUiMargin}px`;
                this.workspace.appendChild(wordleContainer);

                let wc = new WordleContainer(
                    wordleContainer,
                    id,
                    this.datasetManager,
                    this.wordleClient,
                    callback);
                wc.startGame();
            }
        }
    }
}

function docReady(fn) {
    // see if DOM is already available
    if (document.readyState === "complete" || document.readyState === "interactive") {
        // call on next available tick
        setTimeout(fn, 1);
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

docReady(function() {
    let operator = document.getElementById("operators");
    let workspace = document.getElementById("workspace");
    let app = new App(workspace, operator);
    app.render();
});