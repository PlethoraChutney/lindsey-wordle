const wordle_url = window.location.href;
var word_guessed = false;

// setup:
//  - Get the prior guesses, then run them as a guess to "set the board"
//  - Also create the current_guess variable and set it to the proper number

async function getSetup(url = url) {
    const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({"action": "setup"})
    })

    return response.json();
};

function setup_word(word, guesses, answer) {
    const thisGuess = current_guess;
    const row = document.getElementById('guess-' + thisGuess);
    current_guess++;

    for (let i = 0; i < guesses.length; i++) {
        window.setTimeout(() => {
            row.children[i].classList.add(guesses[i]);
            row.children[i].innerHTML = word.charAt(i).toUpperCase();

            let keyboardKey = document.getElementById('key-' + word.charAt(i).toUpperCase());
            if (guesses[i] === 'correct' || keyboardKey.className === 'keyboard-key correct') {
                keyboardKey.className = 'keyboard-key correct';
            } else if (guesses[i] === 'position' || keyboardKey.className === 'keyboard-key position') {
                keyboardKey.className = 'keyboard-key position';
            } else if (guesses[i] === 'wrong') {
                keyboardKey.className = 'keyboard-key wrong';
            }
        }, 250 * i);
    }

    window.setTimeout(() => {
        if (correct_word(guesses)) {
            word_guessed = true;
            for (let i = 0; i < guesses.length; i++) {
                window.setTimeout(() => {
                    row.children[i].classList.add('winner-word');
                }, 75 * i)
            }
            window.setTimeout(() => {
                end_modal('You did it! Nice work!');
            }, 1750);
        } else if (thisGuess == 5) {
            end_modal(`Sorry, better luck next time!\nThe word was ${answer}`);
        }
    }, 1750);

}

let current_guess = 0;
let previous_guesses = [];

getSetup(wordle_url).then((response) => {
    words = response[0];
    guesses = response[1];
    answer = response[2];


    for (let i = 0; i < guesses.length; i++) {
        setup_word(words[i], guesses[i], answer);
        previous_guesses.push(words[i]);
    }

    return words;
});

function correct_word(answer_array) {
    return answer_array.every((v) => v === 'correct');
};

// get leaderboard, make graph
async function getLeaderboard() {
    const response = await fetch(wordle_url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({
            "action": "get_leaderboard",
        })
    })

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

async function make_guess(guess = '') {
    // Keep track of which guess this request corresponds to (for async)
    const thisGuess = current_guess;
    const row = document.getElementById('guess-' + thisGuess);
    current_guess++;
    console.log(previous_guesses);

    if (previous_guesses.includes(guess.toLocaleLowerCase())) {
        row.classList.add('not-a-word');
        current_guess--;
        setTimeout(() => {row.classList.remove('not-a-word')}, 500);
        return false;
    }

    const response = await fetch(wordle_url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({
            "action": "make_guess",
            "guess": guess})
    })
    
    response.json().then((value) => {
        if (value.real_word) {
            previous_guesses.push(guess.toLocaleLowerCase());
            for (let i = 0; i < value.answers.length; i++) {
                window.setTimeout(() => {
                    row.children[i].classList.add(value.answers[i]);
                    row.children[i].innerHTML = guess.charAt(i).toUpperCase();
                }, 250 * i);

                let keyboardKey = document.getElementById('key-' + guess.charAt(i).toUpperCase());
                if (value.answers[i] === 'correct' || keyboardKey.className === 'keyboard-key correct') {
                    keyboardKey.className = 'keyboard-key correct';
                } else if (value.answers[i] === 'position' || keyboardKey.className === 'keyboard-key position') {
                    keyboardKey.className = 'keyboard-key position';
                } else if (value.answers[i] === 'wrong') {
                    keyboardKey.className = 'keyboard-key wrong';
                }
            }
            working_guess = [];

            window.setTimeout(() => {
                if (correct_word(value.answers)) {
                    word_guessed = true;
                    for (let i = 0; i < value.answers.length; i++) {
                        window.setTimeout(() => {
                            row.children[i].classList.add('winner-word');
                        }, 75 * i)
                    }
                    window.setTimeout(() => {
                        end_modal('You did it! Nice work!');
                    }, 1750);
                } else if (value.word && thisGuess == 5) {
                    end_modal('Sorry, better luck next time!\nThe word was ' + value.word + '.');
                }
            }, 1750);

        } else {
            row.classList.add('not-a-word');
            current_guess--;
            setTimeout(() => {row.classList.remove('not-a-word')}, 500);
        }
    })
};

// Keypress handling

let working_guess = [];

function read_key(keypress) {

    if (word_guessed) {
        return true;
    }
    let current_slot = (10 * current_guess) + working_guess.length;
    if (keypress.toUpperCase() === 'BACKSPACE' || keypress.toUpperCase() === 'DEL') {
        current_slot--;
        working_guess.pop();
        $('#position-' + current_slot).text('');
    } else if (keypress.toUpperCase() === 'ENTER') {
        if (working_guess.length === 5) {
            make_guess(working_guess.join(''));
        }
    } else if (working_guess.length < 5) {
        working_guess.push(keypress.toUpperCase());
        $('#position-' + current_slot).text(working_guess[working_guess.length - 1]);
    }
};

$(document).keydown(function(e) {
    // prevent backspace navigation
    if (e.keyCode == 8) {
        e.preventDefault();
        read_key('backspace');
    } else if (e.keyCode == 13) {
        read_key('enter');
    } else if (working_guess.length < 5 && e.keyCode >= 65 && e.keyCode <= 90) {
        read_key(String.fromCharCode(e.which));
    } else if (e.keyCode === 27) {
        $('#end-modal').addClass('hidden');
    }
});

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
    const response = await fetch(wordle_url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({"action": "get_emoji_grid"})
    })

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
    template: `<div class="keyboard-key" :class="usage">{{ keyLetter }}</div>`
}

const LetterSlot = {
    props: ['letterGuess', 'answer'],
    template: `<div class="letter" :class="answer">{{ letterGuess }}</div>`
}

const wordle = Vue.createApp({
    data() {
        return {
            'keyboardKeys': {},
            'letterSlots': []
        }
    },
    components: {
        KeyboardKey,
        LetterSlot
    },
    compilerOptions: {
        delimiters: ['[[', ']]']
    }
});

const vm = wordle.mount('#wordle');


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

// make guess slots
for (let i = 0; i < 30; i++) {
    vm.letterSlots.push({
        id: `ls-${i}`,
        letter: ' ',
        state: null
    })
}