const wordleUrl = window.location.href;

const MultiplayerApp = {
    data() {
        return {
            wordChoice: [
                {id: 0, choice: 'Have Wordle pick for me', selected: true},
                {id: 1, choice: 'Pick my own word', selected: false}
            ],
            selected: 0,
            hasGame: false,
            newGameIn: 0,
            showPostSetup: false,
            gameURL: '',
            ownWord: '',
            isValidWord: false
        }
    },
    computed: {
        validWordEmoji() {
            return this.isValidWord ? '✔️' : '❌'
        },
        validWordHover() {
            return 'Hover text';
        },
        submitButtonText() {
            return this.hasGame ? 'Overwrite old game' : 'Submit';
        },
        canMakeGame() {
            return this.newGameIn <= 0;
        },
        countdownMinuteSecond() {
            minutes = Math.floor(this.newGameIn / 60);
            seconds = (this.newGameIn % 60).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
            return `${minutes}:${seconds}`;
        }
    },
    watch: {
        ownWord(newWord) {
            if (this.ownWord.length !== 5) {
                this.isValidWord = false;
            } else {
                this.checkRealWord(newWord);
            }
        }
    },
    methods: {
        checkRealWord(word) {
            this.isValidWord = false;

            fetch('/', {
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
                    "action": "check_word",
                    "word": word})
            }).then(response => 
                response.json()
                .then(data => 
                    this.isValidWord = data.is_word
                )
            );
        },
        submitWord() {
            if (!this.isValidWord && this.selected === 1) {
                return false;
            }

            fetch(wordleUrl, {
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
                    "action": "make_new_game",
                    "custom_word": this.selected === 1,
                    "word": this.ownWord})
            }).then(response => 
                response.json()
                .then(data => {
                    if (data.url) {
                        this.gameURL = data.url;
                        this.showPostSetup = true;
                    }
                })
            );

        }
    },
    compilerOptions: {
        delimiters: ['[[', ']]']
    }
};

const vm = Vue.createApp(MultiplayerApp).mount('#wordle');

// I know this is dumb but I couldn't get the methods to work, so
//
// haha I think now it might have been just that I don't know how to use
// devtools but I got this working so that's how it's gonna be.
$('#option-container .button').click(function() {
    choice = parseInt($(this)
    .attr('id')
    .split('-')[2]);
    vm.$data.selected = choice;

    window.setTimeout(() => {
        if (choice === 1) {
            $('#word-input').focus();
        }
    }, 100);
});

async function optionsSetup(url = wordleUrl) {
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

optionsSetup().then((value) => {
    vm.$data.hasGame = value.has_game;
    vm.$data.gameURL = value.url;
})