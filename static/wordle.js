const guessesDiv = document.getElementById('guesses');
const keyboardDiv = document.getElementById('keyboard');
const wordle_url = '/';
var word_guessed = false;

// Create the guess area

for (let i = 0; i < 6; i++) {
    let new_guess = document.createElement('div');
    new_guess.setAttribute('id', 'guess-' + i);
    new_guess.className = 'guess';

    for (let j = 0; j < 5; j++) {
        let letter = document.createElement('div');
        letter.classList.add('letter');
        letter.classList.add('column-' + j)
        letter.id = 'position-' + (10*i + j);
        new_guess.appendChild(letter);
    }

    guessesDiv.appendChild(new_guess);
};

// create keyboard

for (const row of ['QWERTYUIOP', 'ASDFGHJKL', '<ZXCVBNM>']) {
    const newRow = document.createElement('div')
    for (let char of row) {
        if (char === '<') {
            char = 'Enter';
        } else if (char === '>') {
            char = 'Del';
        }
        const newKey = document.createElement('div');
        newKey.setAttribute('id', 'key-' + char);
        newKey.classList.add('keyboard-key', 'unused');

        const letterNode = document.createTextNode(char);
        newKey.appendChild(letterNode);
        newRow.appendChild(newKey);
    }
    keyboardDiv.appendChild(newRow);
};

$('.keyboard-key').click(function() {
    var keyPressed = $(this).text();
    read_key(keyPressed);
});

$('.keyboard-key').on('tap', function() {
    var keyPressed = $(this).text();
    read_key(keyPressed);
});

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

function setup_word(word, answers) {
    const thisGuess = current_guess;
    const row = document.getElementById('guess-' + thisGuess);
    current_guess++;

    for (let i = 0; i < answers.length; i++) {
        window.setTimeout(() => {
            row.children[i].classList.add(answers[i]);
            row.children[i].innerHTML = word.charAt(i).toUpperCase();

            let keyboardKey = document.getElementById('key-' + word.charAt(i).toUpperCase());
            if (answers[i] === 'correct' || keyboardKey.className === 'keyboard-key correct') {
                keyboardKey.className = 'keyboard-key correct';
            } else if (answers[i] === 'position' || keyboardKey.className === 'keyboard-key position') {
                keyboardKey.className = 'keyboard-key position';
            } else if (answers[i] === 'wrong') {
                keyboardKey.className = 'keyboard-key wrong';
            }
        }, 250 * i);
    }

    window.setTimeout(() => {
        if (correct_word(answers)) {
            word_guessed = true;
            for (let i = 0; i < answers.length; i++) {
                window.setTimeout(() => {
                    row.children[i].classList.add('winner-word');
                }, 75 * i)
            }
            window.setTimeout(() => {
                end_modal('You did it! Nice work!');
            }, 1750);
        } else if (thisGuess == 5) {
            end_modal('Sorry, better luck next time!');
        }
    }, 1750);

}

let current_guess = 0;

getSetup(wordle_url).then((response) => {
    words = response[0];
    answers = response[1];

    for (let i = 0; i < answers.length; i++) {
        setup_word(words[i], answers[i]);
    }
});

function correct_word(answer_array) {
    return answer_array.every((v) => v === 'correct');
};

// opening and closing of ending modal window

function end_modal(message) {
    $('#modal-content p')
        .text(message);
    $('#end-modal').toggleClass('hidden');
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