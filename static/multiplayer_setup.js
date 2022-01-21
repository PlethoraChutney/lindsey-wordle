const wordleUrl = window.location.href;

const MultiplayerApp = {
    data() {
        return {
            wordChoice: [
                {id: 0, choice: 'Pick my own word', selected: true},
                {id: 1, choice: 'Have Wordle pick for me', selected: false}
            ],
            selected: 0,
            submitted: false,
            sessionId: ''
        }
    },
    compilerOptions: {
        delimiters: ['[[', ']]']
    }
};

const vm = Vue.createApp(MultiplayerApp).mount('#setup-options');

// I know this is dumb but I couldn't get the methods to work, so
//
// haha I think now it might have been just that I don't know how to use
// devtools but I got this working so that's how it's gonna be.
$('#option-container .button').click(function() {
    vm.$data.selected = parseInt($(this)
        .attr('id')
        .split('-')[2]);
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
    vm.$data.sessionId = value.session_id;
})