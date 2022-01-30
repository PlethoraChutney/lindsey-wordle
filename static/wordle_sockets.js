$(document).ready(() => {
    var socket = io();

    var queryStrings = new URLSearchParams(window.location.search);
    let gameId = queryStrings.get('id');
    
    socket.emit('joinRoom', gameId);

    socket.on('write to log', function(msg) {
        console.log(msg.data);
    });
})