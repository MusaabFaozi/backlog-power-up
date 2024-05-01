var backlog_all = function (t) {
    return t.cards().then(board => alert("Hello, there!"))
}

window.TrelloPowerUp.initialize({
    "board-buttons": function(t, options) {
        return [{
            icon: "https://cdn-icons-png.flaticon.com/512/5360/5360758.png",
            text: "Backlog All!",
            callback: backlog_all (t)
        }];
    }
});