from flask import Flask, render_template, request, session
import json
import random
import os
import datetime
import spellchecker
import logging
from uuid import uuid4

app = Flask(__name__)
try:
    app.secret_key = os.environ['SESSION_KEY']
except KeyError:
    logging.warning('$SECRET_KEY not in environment.')
    app.secret_key = 'BAD_SECRET_KEY_FOR_DEVELOPMENT'

with open('words.json', 'r') as f:
    word_list = json.load(f)

# have to use a list so that it is globally modifiable
word_and_time = [
    random.choice(word_list),
    datetime.datetime.now()
]

leaderboard_dict = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0
}


def check_real_word(word):
    # corner case possible where target word isn't in spellchecker
    if word in word_list:
        return True

    checker = spellchecker.SpellChecker()
    return len(checker.unknown([word])) == 0


def make_emoji_grid(session):
    emoji_lists = [check_letter(guess, session['word']) for guess in session['prior_guesses']]
    emoji_lists = [' '.join(x) for x in emoji_lists]
    emoji_lists = [x.replace(
        'wrong', '🟥'
        ).replace(
            'position', '🟦'
            ).replace(
                'correct', '🟩'
                ) for x in emoji_lists]
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
    if not check_real_word(guess):
        return {'real_word': False}

    result = check_letter(guess, session['word'])
    if guess not in session['prior_guesses'] and len(session['prior_guesses']) < 6:
        temp = session['prior_guesses']
        temp.append(guess)
        session['prior_guesses'] = temp

        temp = session['prior_answers']
        temp.append(result)
        session['prior_answers'] = temp

    answer_returns = {
        'real_word': True,
        'answers': result
    }
    if len(session['prior_guesses']) == 6:
        answer_returns['word'] = session['word']
    else:
        answer_returns['word'] = False

    if all([x == 'correct' for x in result]):
        leaderboard_dict[len(session['prior_guesses'])] += 1

    return answer_returns

def check_for_updates():

    # make new daily leaderboard
    if datetime.datetime.today().day != word_and_time[1].day:
        for key in leaderboard_dict.keys():
            leaderboard_dict[key] = 0

    # detect if new word needed
    time_since_word = datetime.datetime.now() - word_and_time[1]
    if time_since_word.total_seconds() > 30 * 60:
        word_and_time[0] = random.choice(word_list)
        session['prior_guesses'] = []
        word_and_time[1] = datetime.datetime.now()


@app.route('/', methods=['GET', 'POST'])
def index():
    # build the page
    if request.method == 'GET':

        check_for_updates()

        # Update session, if necessary
        try:
            if session['word'] != word_and_time[0]:
                session['word'] = word_and_time[0]
                session['prior_guesses'] = []
                session['prior_answers'] = []
                session['word_generation_time'] = word_and_time[1]
        except KeyError:
            session['word'] = word_and_time[0]
            session['prior_guesses'] = []
            session['prior_answers'] = []
            session['word_generation_time'] = word_and_time[1]
            
        use_dark_theme = request.args.get('theme') == 'dark'
        return render_template('wordle.html', night_theme = use_dark_theme)

    elif request.method == 'POST':
        req_json = request.get_json()

        # make a guess
        if req_json['action'] == 'make_guess':
            return json.dumps(
                make_guess(req_json['guess'].lower(), session)
                ), 200, {'ContentType': 'application/json'}

        # get prior guesses
        elif req_json['action'] == 'setup':
            setup_lists = [session['prior_guesses'], session['prior_answers']]
            if len(session['prior_guesses']) == 6:
                setup_lists.append(session['word'])
            return json.dumps(
                setup_lists
            ), 200, {'ContentType': 'application/json'}

        # get emoji grid for sharing
        elif req_json['action'] == 'get_emoji_grid':
            return json.dumps(
                make_emoji_grid(session)
                ), 200, {'ContentType': 'application/json'}

        elif req_json['action'] == 'get_leaderboard':
            return json.dumps(leaderboard_dict), 200, {'ContentType': 'application/json'}


multiplayer_words = {}

@app.route('/multiplayer', methods = ['GET', 'POST'])
def multiplayer():
    if request.method == 'GET':

        try:
            session_id = session['multiplayer_id']
        except KeyError:
            session['multiplayer_id'] = uuid4().hex
            session_id = session['multiplayer_id']

        use_dark_theme = request.args.get('theme') == 'dark'

        if session_id not in multiplayer_words:
            return render_template('multiplayer.html', night_theme = use_dark_theme)

    elif request.method == 'POST':
        rj = request.get_json()

        if rj['action'] == 'setup':
            setup_data = {
                'session_id': session['multiplayer_id']
            }

            return json.dumps(setup_data), 200, {'ContentType': 'application/json'}

