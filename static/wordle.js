const wordle_url = window.location.href;

// setup:
//  - Get the prior guesses, then run them as a guess to "set the board"
//  - Also create the current_guess variable and set it to the proper number

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

// get leaderboard, make graph
async function getLeaderboard() {
    const response = await sendRequest({'action': 'get_leaderboard'});

    response.json().then((value) => {
        leaderDiv = document.getElementById('leaderboard-graph');

        data = [{
            x: Object.keys(value),
            y: Object.values(value),
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

        layout = {
            margin: {t:50},
            title: {
                text: 'Today\'s Wordle Scores',
                font: {}
            },
            yaxis: {
                dtick: 2,
                title: {
                    text: 'Number of other wordlers'
                }
            },
            xaxis: {
                title: {
                    text: 'Guesses to right answer'
                }
            },
            height: 300
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
    })
}

// opening and closing of ending modal window

function end_modal(message) {
    $('#modal-content p')
        .text(message);
    $('#end-modal').toggleClass('hidden');
    getLeaderboard();
};

$('#close-modal').click(() => {
    $('#end-modal').toggleClass('hidden');
});

$('#end-modal').click(function() {
    $('#end-modal').toggleClass('hidden');
});

$('#modal-content').click(function(e) {
    e.stopPropagation();
})

$('#emoji-grid').click(getEmojiGrid);

// Stolen from https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript

function fallbackClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
  
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
  
    try {
      var successful = document.execCommand('copy');
      var msg = successful ? 'successful' : 'unsuccessful';
      console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
  
    document.body.removeChild(textArea);
  }
function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
      fallbackCopyTextToClipboard(text);
      return;
    }
    navigator.clipboard.writeText(text).then(function() {
      console.log('Async: Copying to clipboard was successful!');
    }, function(err) {
      console.error('Async: Could not copy text: ', err);
    });
}

// make emoji grid
async function getEmojiGrid() {
    const response = await sendRequest({'action': 'get_emoji_grid'});

    response.json().then((value) => {
        document.getElementById('grid-actual')
            .innerHTML = value.replace(/\n/gi, '<br/>');
        $('#grid-holder').removeClass('hidden');
        copyTextToClipboard(value);
    })
    
};

$('#grid-actual').click(() => {
    window.getSelection().selectAllChildren(
        document.getElementById('grid-actual')
    );
});

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
            'currentWord': 0
        }
    },
    components: {
        KeyboardKey,
        WordSlot
    },
    computed: {
        wordGuessed() {
            if (this.currentWord === 6) {
                return true
            }

            for (let i = 0; i <= 5; i++) {
                if (this.wordSlots[i].states.every(v => v === 'correct')) {
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
        }
    },
    methods: {
        handleKeypress(keypress) {
            if (this.wordGuessed) {
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
                    }
                }))
        }
    },
    compilerOptions: {
        delimiters: ['[[', ']]']
    }
});

const vm = wordle.mount('#wordle');

sendRequest({
    'action': 'setup'
}).then(response => 
    response.json().then(data => {
        for (let i = 0; i < data[0].length; i ++) {
            vm.updateGuessStates(i, data[1][i], data[0][i].toLocaleUpperCase());
            vm.currentWord++;
        }
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