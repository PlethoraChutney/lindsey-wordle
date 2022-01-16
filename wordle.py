from flask import Flask, render_template, request, session
import json
import random
import requests
import datetime

app = Flask(__name__)
app.secret_key = 'BAD_SECRET_KEY_FOR_LINDSEYS_WORDLE'

with open('words.json', 'r') as f:
    word_list = json.load(f)

# maintain a not-word list to reduce API usage
with open('not-words.json', 'r') as f:
    not_words = json.load(f)

# have to use a list so that it is globally modifiable
word_and_time = [
    random.choice(word_list),
    datetime.datetime.now()
]


def check_real_word(word, word_list):
    # don't steal my Merriam Webster key
    mw_url_and_key = f'https://dictionaryapi.com/api/v3/references/collegiate/json/{word}?key=d8013059-c968-47c9-b30c-0f3de19e7523'

    if word in word_list:
        return True
    elif word in not_words:
        return False

    is_a_word = type(requests.get(mw_url_and_key, timeout = 400).json()[0]) == dict
    if is_a_word:
        word_list.append(word)
        return True
    else:
        not_words.append(word)
        return False

def make_emoji_grid(session):
    emoji_lists = [check_letter(guess, session['word']) for guess in session['prior_guesses']]
    emoji_lists = [' '.join(x) for x in emoji_lists]
    emoji_lists = [x.replace('wrong', '🟥').replace('position', '🟦').replace('correct', '🟩') for x in emoji_lists]
    emoji_grid = '\n'.join(emoji_lists)
    formatted_date = datetime.datetime.strftime(
        session['word_generation_time'],
        '%a, %b %d, %H:%M'
    )
    emoji_grid = f'L-Wordle\n{formatted_date}\n{emoji_grid}'

    return emoji_grid

def check_letter(guess, word):
    letters = ['wrong'] * len(guess)
    word = list(word)
    for i, letter in enumerate(guess):
        if letter == word[i]:
            letters[i] = 'correct'
            word[i] = ' '
    for i, letter in enumerate(guess):
        if letter in word and letters[i] != 'correct':
            letters[i] = 'position'
            word.remove(letter)
    return letters

def make_guess(guess, session):
    if not check_real_word(guess, word_list):
        return {'real_word': False}

    result = check_letter(guess, session['word'])
    if guess not in session['prior_guesses'] and len(session['prior_guesses']) < 6:
        temp = session['prior_guesses']
        temp.append(guess)
        session['prior_guesses'] = temp

    answer_returns = {
        'real_word': True,
        'answers': result
    }
    if len(session['prior_guesses']) == 6:
        answer_returns['word'] = session['word']
    else:
        answer_returns['word'] = False

    return answer_returns

@app.route('/', methods=['GET', 'POST'])
def result():
    # build the page
    if request.method == 'GET':
        time_since_word = datetime.datetime.now() - word_and_time[1]
        if time_since_word.total_seconds() > 30 * 60:
            word_and_time[0] = random.choice(word_list)
            session['prior_guesses'] = []
            word_and_time[1] = datetime.datetime.now()

            # update our word "databases"
            with open('words.json', 'w') as f:
                json.dump(word_list, f)
            with open('not-words.json', 'w') as f:
                json.dump(not_words, f)
            

        try:
            if session['word'] != word_and_time[0]:
                session['word'] = word_and_time[0]
                session['prior_guesses'] = []
                session['word_generation_time'] = word_and_time[1]
        except KeyError:
            session['word'] = word_and_time[0]
            session['prior_guesses'] = []
            session['word_generation_time'] = word_and_time[1]
            
        use_dark_theme = request.args.get('theme') == 'dark'
        return render_template('wordle.html', night_theme = use_dark_theme)

    elif request.method == 'POST':
        req_json = request.get_json()

        # make a guess
        if req_json['action'] == 'make_guess':
            return json.dumps(make_guess(req_json['guess'].lower(), session)), 200, {'ContentType': 'application/json'}

        # get prior guesses
        elif req_json['action'] == 'setup':
            return json.dumps(session['prior_guesses']), 200, {'ContentType': 'application/json'}

        # get emoji grid for sharing
        elif req_json['action'] == 'get_emoji_grid':
            return json.dumps(make_emoji_grid(session)), 200, {'ContentType': 'application/json'}