const wordle_url = window.location.href;

function sendRequest(body) {
    return fetch(wordle_url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(body)
    })
}

const KeyboardKey = {
    props: ['keyLetter', 'usage'],
    template: `
        <div
            class="keyboard-key"
            :class="usage"
            @click="$emit('keyClicked')"
        >{{ keyLetter }}</div>`
}

const LetterSlot = {
    props: ['letterGuess', 'state'],
    template: `<div class="letter" :class="state">{{ letterGuess }}</div>`
}

const WordSlot = {
    props: ['letters', 'states', 'slot-class'],
    components: {LetterSlot},
    template: `
        <div
            :letters="letters"
            :states="states"
        >
            <letter-slot
                v-for="i in [0, 1, 2, 3, 4]"
                :letterGuess="Array.from({...letters, length:5})[i]"
                :state="states[i]"
            ></letter-slot>
        </div>
    `
}

const EmojiGrid = {
    props: ['grid'],
    template: `
    <div id="grid-holder" :class="{'hidden': grid === ''}">
        <div id="grid-actual" @click="selectAll">{{ grid }}</div>
    </div>
    `,
    methods: {
        selectAll() {
            var emojiGrid = document.getElementById('grid-actual');
            window.getSelection().selectAllChildren(emojiGrid);
        }
    }
}

const wordle = Vue.createApp({
    data() {
        return {
            'keyboardKeys': {},
            'wordSlots': [
                {id: 0, word: [], states: Array(5).fill('unused'), slot_class: []},
                {id: 1, word: [], states: Array(5).fill('unused'), slot_class: []},
                {id: 2, word: [], states: Array(5).fill('unused'), slot_class: []},
                {id: 3, word: [], states: Array(5).fill('unused'), slot_class: []},
                {id: 4, word: [], states: Array(5).fill('unused'), slot_class: []},
                {id: 5, word: [], states: Array(5).fill('unused'), slot_class: []}
            ],
            'currentWord': 0,
            'answerWord': '',
            'emojiString': '',
            'showModal': false,
            'playerId': '',
            'customMpGame': false
        }
    },
    components: {
        KeyboardKey,
        WordSlot,
        EmojiGrid
    },
    computed: {
        wordGuessed() {
            for (let i = 0; i <= 5; i++) {
                if (this.wordSlots[i].states.every(v => v.includes('correct'))) {
                    return true
                }
            }

            return false
        },
        previousGuesses() {
            let guesses = [];
            for (let i = 0; i < this.currentWord; i++) {
                guesses.push(this.wordSlots[i].word.join(''));
            }

            return guesses;
        },
        donePlaying() {
            if (this.currentWord == 0) {
                return false;
            }
            return this.wordGuessed || (this.currentWord == 6 && this.wordSlots[this.currentWord - 1].states.every(v => !v.includes('unused')));
        }
    },
    watch: {
        donePlaying: function () {
            // play winner animation and show the modal window
            window.setTimeout(() => {
                if (this.wordGuessed) {
                    this.winnerWord();
                } else {
                    window.setTimeout(() => {
                        this.showModal = true;
                    }, 1250)
                }
            }, 750)

            // get the plotly plot while we wait for the modal window to launch
            // as long as we're not in a multiplayer game
            if (window.location.href.indexOf('multiplayer') == -1) {
            sendRequest({'action': 'get_leaderboard'})
                .then(request => request.json().then(data => {
                    leaderDiv = document.getElementById('leaderboard-graph');

                    let max_y = Math.max(...Object.values(data));
                    if (max_y <= 8) {
                        var breaks = 1
                    } else {
                        var breaks = 2;
                    }

                    data = [{
                        x: Object.keys(data),
                        y: Object.values(data),
                        type: 'bar',
                        marker: {
                            color: '#97B3F0',
                            line: {
                                width: 1
                            }
                        }
                    }];

                    var urlParams = new URLSearchParams(window.location.search);
                    let manual_dark_mode = urlParams.toString().includes('theme=dark');
                    let dark_scheme = window.matchMedia('(prefers-color-scheme: dark)').matches || manual_dark_mode;

                    let plot_width = screen.width;
                    if (plot_width > 600) {
                        plot_width = plot_width/3;
                    } else {
                        plot_width = plot_width * .8;
                    }

                    layout = {
                        margin: {t:50},
                        title: {
                            text: 'Today\'s Wordle Scores',
                            font: {}
                        },
                        yaxis: {
                            dtick: breaks,
                            title: {
                                text: 'Number of wordlers'
                            }
                        },
                        xaxis: {
                            title: {
                                text: 'Guesses to right answer'
                            }
                        },
                        height: 300,
                        width: plot_width,
                        autosize: true
                    };

                    if (dark_scheme) {
                        layout['plot_bgcolor'] = '#151821';
                        layout['paper_bgcolor'] = '#151821';
                        layout['yaxis']['color'] = '#AAA';
                        layout['xaxis']['color'] = '#AAA';
                        layout['title']['font']['color'] = '#AAA';

                        data[0]['marker']['color'] = '#566FA3';
                    }

                    config = {
                        displayModeBar: false,
                        responsive: true
                    };

                    Plotly.newPlot(leaderDiv, data, layout, config)
                }))}
        }
    },
    methods: {
        handleKeypress(keypress) {
            var urlParams = new URLSearchParams(window.location.search);
            let custom_game_creator = urlParams.toString().includes(this.playerId);

            if (this.donePlaying || (this.customMpGame && custom_game_creator)) {
                return true;
            }
            
            if (keypress.toUpperCase() === 'BACKSPACE' || keypress.toUpperCase() === 'DEL') {
                this.wordSlots[this.currentWord].word.pop();
            } else if (keypress.toUpperCase() === 'ENTER') {
                currentWord = this.wordSlots[this.currentWord].word.join('');
                if (currentWord.length === 5) {
                    this.makeGuess(currentWord);
                }
            } else if (this.wordSlots[this.currentWord].word.length < 5) {
                this.wordSlots[this.currentWord].word.push(keypress.toUpperCase());
            }
        },
        notAWord() {
            this.wordSlots[this.currentWord].slot_class.push('not-a-word');
            window.setTimeout(() => {
                this.wordSlots[this.currentWord].slot_class.pop();
            }, 750)
        },
        winnerWord() {
            this.answerWord = this.wordSlots[this.currentWord - 1].word.join('');
            for (let i = 0; i < 5; i ++) {
                window.setTimeout(() => {
                    this.wordSlots[this.currentWord - 1].states[i] = this.wordSlots[this.currentWord - 1].states[i] + ' winner-word'
                }, 125 * i);
            }
            window.setTimeout(() => {
                this.showModal = true;
            }, 1250);
        },
        updateGuessStates(slot, newStates, newLetters = this.wordSlots[slot].word) {
            for (let i = 0; i < 5; i ++) {
                window.setTimeout(() => {
                    this.wordSlots[slot].states[i] = newStates[i]
                    this.wordSlots[slot].word[i] = newLetters[i]
                    statePriority = ['correct', 'position', 'wrong', 'unused']
                    newKeyState = statePriority.indexOf(this.keyboardKeys[newLetters[i]].state) < statePriority.indexOf(newStates[i]) ? this.keyboardKeys[newLetters[i]].state : newStates[i]
                    this.keyboardKeys[newLetters[i]].state = newKeyState
                }, 250 * i)
            }
        },
        makeGuess(guess) {
            if (this.previousGuesses.includes(guess.toLocaleUpperCase())) {
                this.notAWord();
                return false;
            }
            sendRequest({
                "action": "make_guess",
                "guess": guess.toLocaleLowerCase()
            }).then(response => 
                response.json().then(data => {
                    if (!data.real_word) {
                        this.notAWord();
                    } else {
                        this.updateGuessStates(this.currentWord, data.answers);
                        this.currentWord++;
                        if (data.word) {
                            this.answerWord = data.word.toLocaleUpperCase();
                        }
                    }
                }))
        },
        getEmojiGrid() {
            sendRequest({
                'action': 'get_emoji_grid'
            }).then(response => response.json().then(data => {
                this.emojiString = data.emoji_string;
            }))

            window.setTimeout(this.emojiToClipboard, 250);
        },
        emojiToClipboard() {
            var emojiGrid = document.getElementById('grid-actual');

            if (!navigator.clipboard) {
                emojiGrid.focus();
                emojiGrid.select();
                window.getSelection().removeAllRanges();
            
                try {
                var successful = document.execCommand('copy');
                } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
                }
            } else {
            navigator.clipboard.writeText(emojiGrid.textContent);
            }
        }
    },
    compilerOptions: {
        delimiters: ['[[', ']]']
    },
    beforeCreate() {
        $('#end-modal').removeClass('hidden')
    }
});


$('#end-modal').removeClass('hidden');
const vm = wordle.mount('#wordle');

sendRequest({
    'action': 'setup'
}).then(response => 
    response.json().then(data => {
        for (let i = 0; i < data['guesses'].length; i ++) {
            vm.updateGuessStates(i, data['answers'][i], data['guesses'][i].toLocaleUpperCase());
            vm.currentWord++;
        }
        if ('word' in data) {
            vm.answerWord = data['word'].toLocaleUpperCase();
        }
        if ('player_id' in data) {vm.playerId = data.player_id;}
        if ('custom' in data) {vm.customMpGame = data.custom;}
    }))

// set up keyboard
for (let i = 0; i <= 18; i++) {
    let char = 'QWERTYUIOPASDFGHJKL'.charAt(i);
    vm.$data.keyboardKeys[char] = {
        id: char,
        keyLetter: char,
        state: 'unused'
    }
};

vm.$data.keyboardKeys['Enter'] = {
    id: 'Enter',
    keyLetter: 'Enter',
    state: 'unused'
};

for (let i = 0; i <= 8; i++) {
    let char = 'ZXCVBNM'.charAt(i);
    vm.$data.keyboardKeys[char] = {
        id: char,
        keyLetter: char,
        state: 'unused'
    }
};

vm.$data.keyboardKeys['Del'] = {
    id: 'Del',
    keyLetter: 'Del',
    state: 'unused'
};

// Not sure where this blank element comes from but this is easier than finding out
delete vm.$data.keyboardKeys['']

$(document).keydown(function(e) {
    // prevent backspace navigation
    if (e.keyCode == 8) {
        e.preventDefault();
        vm.handleKeypress('backspace');
    } else if (e.keyCode == 13) {
        vm.handleKeypress('enter');
    } else if (e.keyCode >= 65 && e.keyCode <= 90) {
        vm.handleKeypress(String.fromCharCode(e.which));
    } else if (e.keyCode === 27) {
        $('#end-modal').addClass('hidden');
    }
});
