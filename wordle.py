from flask import Flask, render_template, request, session, redirect
from flask_socketio import SocketIO
import json
import random
import os
from datetime import datetime
import spellchecker
import logging
from uuid import uuid4

app = Flask(__name__)
try:
    app.secret_key = os.environ['SECRET_KEY']
except KeyError:
    logging.warning('$SECRET_KEY not in environment.')
    app.secret_key = 'BAD_SECRET_KEY_FOR_DEVELOPMENT'

socketio = SocketIO(app)

with open('words.json', 'r') as f:
    word_list = json.load(f)

# have to use a list so that it is globally modifiable
word_and_time = [
    random.choice(word_list),
    datetime.now()
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


def make_emoji_grid(guesses, word, puzzle_id):
    emoji_lists = [check_letter(guess, word) for guess in guesses]
    if all([x == 'correct' for x in emoji_lists[-1]]):
        fraction = f' · {len(emoji_lists)}/6'
    else:
        fraction = ''
    emoji_lists = [' '.join(x) for x in emoji_lists]
    emoji_lists = [x.replace(
        'wrong', '🟥'
        ).replace(
            'position', '🟦'
            ).replace(
                'correct', '🟩'
                ) for x in emoji_lists]
    emoji_grid = '\n'.join(emoji_lists)
    if isinstance(puzzle_id, datetime):
        puzzle_id = datetime.strftime(
            puzzle_id,
            '%a, %b %d, %H:%M'
        )
    else:
        puzzle_id = puzzle_id
    emoji_grid = f'L-Wordle{fraction}\n{puzzle_id}\n{emoji_grid}'

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
    if datetime.today().day != word_and_time[1].day:
        for key in leaderboard_dict.keys():
            leaderboard_dict[key] = 0

    # detect if new word needed
    time_since_word = datetime.now() - word_and_time[1]
    if time_since_word.total_seconds() > 30 * 60:
        word_and_time[0] = random.choice(word_list)
        session['prior_guesses'] = []
        word_and_time[1] = datetime.now()


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
        app.logger.debug(word_and_time[0])
        return render_template('wordle.html', night_theme = use_dark_theme)

    elif request.method == 'POST':
        req_json = request.get_json()

        # make a guess
        if req_json['action'] == 'make_guess':
            return json.dumps(
                make_guess(req_json['guess'].lower(), session)
                ), 200, {'ContentType': 'application/json'}

        # just check a word
        elif req_json['action'] == 'check_word':
            return json.dumps(
                {'is_word': check_real_word(req_json['word'])}
            ), 200, {'ContentType': 'application/json'}

        # get prior guesses
        elif req_json['action'] == 'setup':
            setup_lists = {
                'guesses': session['prior_guesses'],
                'answers': session['prior_answers']
            }
            if len(session['prior_guesses']) == 6:
                setup_lists['word'] = session['word']
            return json.dumps(
                setup_lists
            ), 200, {'ContentType': 'application/json'}

        # get emoji grid for sharing
        elif req_json['action'] == 'get_emoji_grid':
            return json.dumps(
                {'emoji_string': make_emoji_grid(
                    session['prior_guesses'],
                    session['word'],
                    session['word_generation_time']
                )}
                ), 200, {'ContentType': 'application/json'}

        elif req_json['action'] == 'get_leaderboard':
            return json.dumps(leaderboard_dict), 200, {'ContentType': 'application/json'}


multiplayer_words = {}
@app.route('/multiplayer/', methods = ['GET', 'POST'])
def multiplayer_setup():
    if request.method == 'GET':

        if 'multiplayer_id' not in session:
            session['multiplayer_id'] = uuid4().hex

        use_dark_theme = request.args.get('theme') == 'dark'

        return render_template('multiplayer.html', night_theme = use_dark_theme)

    elif request.method == 'POST':
        rj = request.get_json()
        use_theme = request.args.get('theme')
        sess_id = session.get('multiplayer_id')

        if rj['action'] == 'setup':
            has_game = sess_id in multiplayer_words
            setup_data = {
                'has_game': has_game
            }

            if has_game:
                setup_data['url'] = f'/multiplayer/game?id={sess_id}&theme={use_theme}'
                setup_data['time_remaining'] =\
                    30*60 - (datetime.now() - multiplayer_words[sess_id]['game_created_time']).seconds

            return json.dumps(setup_data), 200, {'ContentType': 'application/json'}

        elif rj['action'] == 'make_new_game':
            if rj['custom_word']:
                assert check_real_word(rj['word'])
                word = rj['word']
            else:
                word = random.choice(word_list)

            if sess_id in multiplayer_words:
                if (datetime.now() - multiplayer_words[sess_id]['game_created_time']).seconds/60 < 30:
                    return json.dumps({
                        'url': False,
                        'reason': 'Game made too recently'
                    }), 200, {'ContentType': 'application/json'}

            multiplayer_words[sess_id] = {
                'word': word,
                'custom': rj['custom_word'],
                'guesses': [],
                'answers': [],
                'game_created_time': datetime.now()
            }

            game_url = f'/multiplayer/game?id={sess_id}&theme={use_theme}'

            return json.dumps({
                'url': game_url
            }), 200, {'ContentType': 'application/json'}


def multiplayer_make_guess(guess, game_id):
    if not check_real_word(guess):
        return {'real_word': False}

    result = check_letter(guess, multiplayer_words[game_id]['word'])
    if guess not in multiplayer_words[game_id]['guesses']\
    and len(multiplayer_words[game_id]['guesses']) < 6:
        temp = multiplayer_words[game_id]['guesses']
        temp.append(guess)
        multiplayer_words[game_id]['guesses'] = temp

        temp = multiplayer_words[game_id]['answers']
        temp.append(result)
        multiplayer_words[game_id]['answers'] = temp

    answer_returns = {
        'real_word': True,
        'answers': result
    }
    if len(multiplayer_words[game_id]['guesses']) == 6:
        answer_returns['word'] = multiplayer_words[game_id]['word']
    else:
        answer_returns['word'] = False

    return answer_returns

                
@app.route('/multiplayer/game', methods = ['GET', 'POST'])
def multiplayer_game():
    game_id = request.args.get('id')
    if game_id is None:
        return redirect('/multiplayer')

    game_info = multiplayer_words.get(game_id)
    if game_info is None:
        return redirect('/multiplayer')


    if request.method == 'GET':
        use_dark_theme = request.args.get('theme') == 'dark'
        app.logger.debug(game_info)

        if 'multiplayer_id' not in session:
            session['multiplayer_id'] = uuid4().hex

        return render_template('multiplayer_game.html', night_theme = use_dark_theme)

    elif request.method == 'POST':
        rj = request.get_json()

        if rj['action'] == 'setup':
            setup_lists = {
                'guesses': multiplayer_words[game_id]['guesses'],
                'answers': multiplayer_words[game_id]['answers'],
                'player_id': session['multiplayer_id'],
                'custom': multiplayer_words[game_id]['custom']
            }
            if len(multiplayer_words[game_id]['guesses']) == 6:
                setup_lists['word'] = multiplayer_words[game_id]['word']

            return json.dumps(
                setup_lists
            ), 200, {'ContentType': 'application/json'}

        # make a guess
        if rj['action'] == 'make_guess':
            return json.dumps(
                multiplayer_make_guess(rj['guess'].lower(), game_id)
                ), 200, {'ContentType': 'application/json'}

        # just check a word
        elif rj['action'] == 'check_word':
            return json.dumps(
                {'is_word': check_real_word(rj['word'])}
            ), 200, {'ContentType': 'application/json'}

        # get emoji grid for sharing
        elif rj['action'] == 'get_emoji_grid':
            return json.dumps(
                {'emoji_string': make_emoji_grid(
                    multiplayer_words[game_id]['guesses'],
                    multiplayer_words[game_id]['word'],
                    game_id[-7:]
                    )}
                ), 200, {'ContentType': 'application/json'}

        elif rj['action'] == 'get_leaderboard':
            return json.dumps(leaderboard_dict), 200, {'ContentType': 'application/json'}

if __name__ == '__main__':
    socketio.run(app)